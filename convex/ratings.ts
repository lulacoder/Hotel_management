import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  requireCustomer,
  requireHotelAccess,
  requireHotelManagement,
  requireUser,
} from './lib/auth'
import { createAuditLog } from './audit'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

// Applies a delta to the hotel's denormalized rating tally. Hotels that have
// not been backfilled yet (ratingCount undefined) are left untouched so the
// tally is never partial — getSummaries falls back to a full scan for them
// until ratingsInternal.backfillRatingTallies initializes the counters.
async function applyRatingTallyDelta(
  ctx: MutationCtx,
  hotelId: Id<'hotels'>,
  sumDelta: number,
  countDelta: number,
) {
  const hotel = await ctx.db.get(hotelId)
  if (!hotel || hotel.ratingCount === undefined) {
    return
  }

  await ctx.db.patch(hotelId, {
    ratingSum: (hotel.ratingSum ?? 0) + sumDelta,
    ratingCount: Math.max(0, hotel.ratingCount + countDelta),
  })
}

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

// Computes the average rating and total review count for an array of hotel IDs.
// Reads the denormalized ratingSum/ratingCount tally on each hotel, so the cost
// is one document read per hotel regardless of how many reviews it has.
// Hotels not yet backfilled (ratingCount undefined) fall back to scanning
// their active ratings; ratingsInternal.backfillRatingTallies removes that path.
// If a hotel has no ratings, its average is 0.
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
    return await Promise.all(
      args.hotelIds.map(async (hotelId) => {
        const hotel = await ctx.db.get(hotelId)

        if (hotel && hotel.ratingCount !== undefined) {
          const count = hotel.ratingCount
          const average = count === 0 ? 0 : (hotel.ratingSum ?? 0) / count
          return { hotelId, average, count }
        }

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

        return { hotelId, average, count }
      }),
    )
  },
})

// Retrieves up to a specified limit (default 50) of recent active ratings for a single hotel.
// Soft-deleted ratings are excluded. Ordered descending by creation time.
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

// Retrieves the currently logged-in user's active rating for a specified hotel.
// If the user has not left a review or the review has been soft-deleted, it returns null.
export const getMyRatingForHotel = query({
  args: {
    hotelId: v.id('hotels'),
  },
  returns: v.union(ratingValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
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

// Submits a new rating or updates an existing rating for a hotel by the current customer.
// Only accessible to customers. Verifies the hotel exists and that the rating is
// an integer between 1 and 5. Reviews over 500 characters are rejected.
// Restores a soft-deleted review if the user updates it.
export const upsertRating = mutation({
  args: {
    hotelId: v.id('hotels'),
    rating: v.number(),
    review: v.optional(v.string()),
  },
  returns: v.id('hotelRatings'),
  handler: async (ctx, args) => {
    const customer = await requireCustomer(ctx)
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

      // A soft-deleted rating re-enters the tally; an active one only shifts
      // the sum by the score change.
      if (existing.isDeleted) {
        await applyRatingTallyDelta(ctx, args.hotelId, args.rating, 1)
      } else {
        await applyRatingTallyDelta(
          ctx,
          args.hotelId,
          args.rating - existing.rating,
          0,
        )
      }

      return existing._id
    }

    const ratingId = await ctx.db.insert('hotelRatings', {
      hotelId: args.hotelId,
      userId: customer._id,
      rating: args.rating,
      review: review || undefined,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    await applyRatingTallyDelta(ctx, args.hotelId, args.rating, 1)

    return ratingId
  },
})

// Soft deletes a hotel rating (only allowed by hotel administration).
// Used by hotel admins to moderate inappropriate reviews. Sets isDeleted=true
// and logs the deletion via an audit event.
export const softDeleteRating = mutation({
  args: {
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

    const { user } = await requireHotelManagement(ctx, rating.hotelId)

    if (rating.isDeleted) {
      return null
    }

    await ctx.db.patch(args.ratingId, {
      isDeleted: true,
      updatedAt: Date.now(),
    })

    await applyRatingTallyDelta(ctx, rating.hotelId, -rating.rating, -1)

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

// Fetches recent ratings for an administration dashboard.
// Includes details about the reviewer user's profile alongside their review.
// Only room admins or hotel staff assigned to this hotel can use this query.
// It bypasses the soft-delete check internally but ignores deleted ratings.
export const getHotelRatingsAdmin = query({
  args: {
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
    await requireHotelAccess(ctx, args.hotelId)
    const limit = args.limit ?? 50

    const ratings = await ctx.db
      .query('hotelRatings')
      .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
      .order('desc')
      .take(limit)

    return await Promise.all(
      ratings
        .filter((rating) => !rating.isDeleted)
        .map(async (rating) => {
          const user = await ctx.db.get(rating.userId)
          return {
            ...rating,
            user: user
              ? {
                  _id: user._id,
                  clerkUserId: user.clerkUserId,
                  email: user.email,
                  role: user.role,
                }
              : null,
          }
        }),
    )
  },
})
