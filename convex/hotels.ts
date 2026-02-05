import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { ConvexError } from 'convex/values'
import { requireAdmin } from './lib/auth'
import { createAuditLog } from './audit'

// Validator for hotel document (used in return types)
const hotelValidator = v.object({
  _id: v.id('hotels'),
  _creationTime: v.number(),
  name: v.string(),
  address: v.string(),
  city: v.string(),
  country: v.string(),
  location: v.optional(
    v.object({
      lat: v.number(),
      lng: v.number(),
    }),
  ),
  metadata: v.optional(v.record(v.string(), v.any())),
  isDeleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

// List all active hotels
export const list = query({
  args: {
    includeDeleted: v.optional(v.boolean()),
  },
  returns: v.array(hotelValidator),
  handler: async (ctx, args) => {
    if (args.includeDeleted) {
      return await ctx.db.query('hotels').collect()
    }

    return await ctx.db
      .query('hotels')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
  },
})

// Get hotels by city
export const getByCity = query({
  args: {
    city: v.string(),
  },
  returns: v.array(hotelValidator),
  handler: async (ctx, args) => {
    const hotels = await ctx.db
      .query('hotels')
      .withIndex('by_city', (q) => q.eq('city', args.city))
      .collect()

    // Filter out deleted hotels
    return hotels.filter((hotel) => !hotel.isDeleted)
  },
})

// Search hotels by name
export const search = query({
  args: {
    searchTerm: v.string(),
    city: v.optional(v.string()),
  },
  returns: v.array(hotelValidator),
  handler: async (ctx, args) => {
    let searchQuery = ctx.db
      .query('hotels')
      .withSearchIndex('search_name', (q) => {
        let search = q.search('name', args.searchTerm)
        if (args.city) {
          search = search.eq('city', args.city)
        }
        return search.eq('isDeleted', false)
      })

    return await searchQuery.collect()
  },
})

// Get a single hotel by ID
export const get = query({
  args: {
    hotelId: v.id('hotels'),
  },
  returns: v.union(hotelValidator, v.null()),
  handler: async (ctx, args) => {
    const hotel = await ctx.db.get(args.hotelId)
    if (!hotel || hotel.isDeleted) {
      return null
    }
    return hotel
  },
})

// Create a new hotel (admin only)
export const create = mutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    address: v.string(),
    city: v.string(),
    country: v.string(),
    location: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
      }),
    ),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.id('hotels'),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.clerkUserId)

    const now = Date.now()
    const hotelId = await ctx.db.insert('hotels', {
      name: args.name,
      address: args.address,
      city: args.city,
      country: args.country,
      location: args.location,
      metadata: args.metadata,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    // Log the creation
    await createAuditLog(ctx, {
      actorId: admin._id,
      action: 'hotel_created',
      targetType: 'hotel',
      targetId: hotelId,
      newValue: {
        name: args.name,
        city: args.city,
        country: args.country,
      },
    })

    return hotelId
  },
})

// Update a hotel (admin only)
export const update = mutation({
  args: {
    clerkUserId: v.string(),
    hotelId: v.id('hotels'),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    location: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
      }),
    ),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.clerkUserId)

    const hotel = await ctx.db.get(args.hotelId)
    if (!hotel) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Hotel not found.',
      })
    }

    if (hotel.isDeleted) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Cannot update a deleted hotel.',
      })
    }

    // Build the update object with only provided fields
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    }

    const previousValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}

    if (args.name !== undefined) {
      previousValues.name = hotel.name
      newValues.name = args.name
      updates.name = args.name
    }
    if (args.address !== undefined) {
      previousValues.address = hotel.address
      newValues.address = args.address
      updates.address = args.address
    }
    if (args.city !== undefined) {
      previousValues.city = hotel.city
      newValues.city = args.city
      updates.city = args.city
    }
    if (args.country !== undefined) {
      previousValues.country = hotel.country
      newValues.country = args.country
      updates.country = args.country
    }
    if (args.location !== undefined) {
      previousValues.location = hotel.location
      newValues.location = args.location
      updates.location = args.location
    }
    if (args.metadata !== undefined) {
      previousValues.metadata = hotel.metadata
      newValues.metadata = args.metadata
      updates.metadata = args.metadata
    }

    await ctx.db.patch(args.hotelId, updates)

    // Log the update
    await createAuditLog(ctx, {
      actorId: admin._id,
      action: 'hotel_updated',
      targetType: 'hotel',
      targetId: args.hotelId,
      previousValue: previousValues,
      newValue: newValues,
    })

    return null
  },
})

// Soft delete a hotel (admin only)
export const softDelete = mutation({
  args: {
    clerkUserId: v.string(),
    hotelId: v.id('hotels'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.clerkUserId)

    const hotel = await ctx.db.get(args.hotelId)
    if (!hotel) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Hotel not found.',
      })
    }

    if (hotel.isDeleted) {
      // Already deleted, idempotent operation
      return null
    }

    await ctx.db.patch(args.hotelId, {
      isDeleted: true,
      updatedAt: Date.now(),
    })

    // Log the deletion
    await createAuditLog(ctx, {
      actorId: admin._id,
      action: 'hotel_deleted',
      targetType: 'hotel',
      targetId: args.hotelId,
      previousValue: { isDeleted: false },
      newValue: { isDeleted: true },
    })

    return null
  },
})

// Restore a soft-deleted hotel (admin only)
export const restore = mutation({
  args: {
    clerkUserId: v.string(),
    hotelId: v.id('hotels'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.clerkUserId)

    const hotel = await ctx.db.get(args.hotelId)
    if (!hotel) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Hotel not found.',
      })
    }

    if (!hotel.isDeleted) {
      // Already active, idempotent operation
      return null
    }

    await ctx.db.patch(args.hotelId, {
      isDeleted: false,
      updatedAt: Date.now(),
    })

    // Log the restoration
    await createAuditLog(ctx, {
      actorId: admin._id,
      action: 'hotel_restored',
      targetType: 'hotel',
      targetId: args.hotelId,
      previousValue: { isDeleted: true },
      newValue: { isDeleted: false },
    })

    return null
  },
})

// Get unique cities (for filtering)
export const getCities = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const hotels = await ctx.db
      .query('hotels')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    const cities = [...new Set(hotels.map((h) => h.city))]
    return cities.sort()
  },
})

// Get unique countries (for filtering)
export const getCountries = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const hotels = await ctx.db
      .query('hotels')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    const countries = [...new Set(hotels.map((h) => h.country))]
    return countries.sort()
  },
})
