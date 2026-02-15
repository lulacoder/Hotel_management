import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  requireCustomer,
  requireHotelAccess,
  requireHotelManagement,
  requireUser,
} from './lib/auth'
import { createAuditLog } from './audit'

const ratingValidator = v.object({
  _id: v.id('hotelRatings'),
  _creationTime: v.number(),
  hotelId: v.id('hotels'),
  userId: v.id('users'),
  rating: v.number(),
  review: v.optional(v.string()),
  isDeleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const getSummaries = query({
  args: {
    hotelIds: v.array(v.id('hotels')),
  },
  returns: v.array(
    v.object({
      hotelId: v.id('hotels'),
      average: v.number(),
      count: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const summaries = []

    for (const hotelId of args.hotelIds) {
      const ratings = await ctx.db
        .query('hotelRatings')
        .withIndex('by_hotel_and_is_deleted', (q) =>
          q.eq('hotelId', hotelId).eq('isDeleted', false),
        )
        .collect()

      const count = ratings.length
      const average =
        count === 0
          ? 0
          : ratings.reduce((sum, rating) => sum + rating.rating, 0) / count

      summaries.push({ hotelId, average, count })
    }

    return summaries
  },
})

export const getHotelRatings = query({
  args: {
    hotelId: v.id('hotels'),
    limit: v.optional(v.number()),
  },
  returns: v.array(ratingValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50

    return await ctx.db
      .query('hotelRatings')
      .withIndex('by_hotel_and_is_deleted', (q) =>
        q.eq('hotelId', args.hotelId).eq('isDeleted', false),
      )
      .order('desc')
      .take(limit)
  },
})

export const getMyRatingForHotel = query({
  args: {
    clerkUserId: v.string(),
    hotelId: v.id('hotels'),
  },
  returns: v.union(ratingValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)
    const rating = await ctx.db
      .query('hotelRatings')
      .withIndex('by_user_and_hotel', (q) =>
        q.eq('userId', user._id).eq('hotelId', args.hotelId),
      )
      .unique()

    if (!rating || rating.isDeleted) {
      return null
    }

    return rating
  },
})

export const upsertRating = mutation({
  args: {
    clerkUserId: v.string(),
    hotelId: v.id('hotels'),
    rating: v.number(),
    review: v.optional(v.string()),
  },
  returns: v.id('hotelRatings'),
  handler: async (ctx, args) => {
    const customer = await requireCustomer(ctx, args.clerkUserId)
    const hotel = await ctx.db.get(args.hotelId)

    if (!hotel || hotel.isDeleted) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Hotel not found.',
      })
    }

    if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Rating must be an integer between 1 and 5.',
      })
    }

    const review = args.review?.trim()
    if (review && review.length > 500) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Review must be 500 characters or less.',
      })
    }

    const existing = await ctx.db
      .query('hotelRatings')
      .withIndex('by_user_and_hotel', (q) =>
        q.eq('userId', customer._id).eq('hotelId', args.hotelId),
      )
      .unique()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        review: review || undefined,
        isDeleted: false,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('hotelRatings', {
      hotelId: args.hotelId,
      userId: customer._id,
      rating: args.rating,
      review: review || undefined,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const softDeleteRating = mutation({
  args: {
    clerkUserId: v.string(),
    ratingId: v.id('hotelRatings'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rating = await ctx.db.get(args.ratingId)

    if (!rating) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Rating not found.',
      })
    }

    const { user } = await requireHotelManagement(
      ctx,
      args.clerkUserId,
      rating.hotelId,
    )

    if (rating.isDeleted) {
      return null
    }

    await ctx.db.patch(args.ratingId, {
      isDeleted: true,
      updatedAt: Date.now(),
    })

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'rating_deleted',
      targetType: 'rating',
      targetId: rating._id,
      previousValue: { isDeleted: false },
      newValue: { isDeleted: true },
      metadata: {
        hotelId: rating.hotelId,
        userId: rating.userId,
      },
    })

    return null
  },
})

export const getHotelRatingsAdmin = query({
  args: {
    clerkUserId: v.string(),
    hotelId: v.id('hotels'),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('hotelRatings'),
      _creationTime: v.number(),
      hotelId: v.id('hotels'),
      userId: v.id('users'),
      rating: v.number(),
      review: v.optional(v.string()),
      isDeleted: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      user: v.union(
        v.object({
          _id: v.id('users'),
          clerkUserId: v.string(),
          email: v.string(),
          role: v.union(v.literal('customer'), v.literal('room_admin')),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireHotelAccess(ctx, args.clerkUserId, args.hotelId)
    const limit = args.limit ?? 50

    const ratings = await ctx.db
      .query('hotelRatings')
      .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
      .order('desc')
      .take(limit)

    const results = []

    for (const rating of ratings) {
      if (rating.isDeleted) {
        continue
      }
      const user = await ctx.db.get(rating.userId)
      results.push({
        ...rating,
        user: user
          ? {
              _id: user._id,
              clerkUserId: user.clerkUserId,
              email: user.email,
              role: user.role,
            }
          : null,
      })
    }

    return results
  },
})
