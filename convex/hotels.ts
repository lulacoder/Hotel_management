import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAdmin, requireHotelManagement, requireUser } from './lib/auth'
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
  // New fields
  externalId: v.optional(v.string()),
  description: v.optional(v.string()),
  category: v.optional(
    v.union(
      v.literal('Boutique'),
      v.literal('Budget'),
      v.literal('Luxury'),
      v.literal('Resort and Spa'),
      v.literal('Extended-Stay'),
      v.literal('Suite'),
    ),
  ),
  tags: v.optional(v.array(v.string())),
  parkingIncluded: v.optional(v.boolean()),
  rating: v.optional(v.number()),
  stateProvince: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  lastRenovationDate: v.optional(v.string()),
  metadata: v.optional(v.record(v.string(), v.any())),
  isDeleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

// Category validator for reuse
const categoryValidator = v.union(
  v.literal('Boutique'),
  v.literal('Budget'),
  v.literal('Luxury'),
  v.literal('Resort and Spa'),
  v.literal('Extended-Stay'),
  v.literal('Suite'),
)

const normalizeLocation = (args: {
  location?: { lat: number; lng: number }
  latitude?: number
  longitude?: number
}) => {
  if (args.location) {
    return args.location
  }

  const hasLatitude = args.latitude !== undefined
  const hasLongitude = args.longitude !== undefined
  if (hasLatitude !== hasLongitude) {
    throw new ConvexError({
      code: 'INVALID_ARGUMENT',
      message: 'Both latitude and longitude are required when setting location.',
    })
  }

  if (hasLatitude && hasLongitude) {
    return { lat: args.latitude as number, lng: args.longitude as number }
  }

  return undefined
}

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

// List active hotels for outsource destination selection
export const listForOutsource = query({
  args: {
    clerkUserId: v.string(),
    excludeHotelId: v.id('hotels'),
  },
  returns: v.array(
    v.object({
      _id: v.id('hotels'),
      name: v.string(),
      city: v.string(),
      country: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx, args.clerkUserId)

    const hotels = await ctx.db
      .query('hotels')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()

    return hotels
      .filter((hotel) => hotel._id !== args.excludeHotelId)
      .map((hotel) => ({
        _id: hotel._id,
        name: hotel.name,
        city: hotel.city,
        country: hotel.country,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
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
    const searchQuery = ctx.db
      .query('hotels')
      .withSearchIndex('search_name', (q) => {
        let searchBuilder = q.search('name', args.searchTerm)
        if (args.city) {
          searchBuilder = searchBuilder.eq('city', args.city)
        }
        return searchBuilder.eq('isDeleted', false)
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
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    // New optional fields
    externalId: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(categoryValidator),
    tags: v.optional(v.array(v.string())),
    parkingIncluded: v.optional(v.boolean()),
    rating: v.optional(v.number()),
    stateProvince: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    lastRenovationDate: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.id('hotels'),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.clerkUserId)
    const normalizedLocation = normalizeLocation(args)

    const now = Date.now()
    const hotelId = await ctx.db.insert('hotels', {
      name: args.name,
      address: args.address,
      city: args.city,
      country: args.country,
      location: normalizedLocation,
      externalId: args.externalId,
      description: args.description,
      category: args.category,
      tags: args.tags,
      parkingIncluded: args.parkingIncluded,
      rating: args.rating,
      stateProvince: args.stateProvince,
      postalCode: args.postalCode,
      lastRenovationDate: args.lastRenovationDate,
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
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    // New optional fields
    externalId: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(categoryValidator),
    tags: v.optional(v.array(v.string())),
    parkingIncluded: v.optional(v.boolean()),
    rating: v.optional(v.number()),
    stateProvince: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    lastRenovationDate: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireHotelManagement(ctx, args.clerkUserId, args.hotelId)

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

    const normalizedLocation = normalizeLocation(args)

    // Build the update object with only provided fields
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    }

    const previousValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}

    // Helper to track changes
    const trackChange = (key: string, newValue: unknown, oldValue: unknown) => {
      if (newValue !== undefined) {
        previousValues[key] = oldValue
        newValues[key] = newValue
        updates[key] = newValue
      }
    }

    trackChange('name', args.name, hotel.name)
    trackChange('address', args.address, hotel.address)
    trackChange('city', args.city, hotel.city)
    trackChange('country', args.country, hotel.country)
    trackChange('location', normalizedLocation, hotel.location)
    trackChange('externalId', args.externalId, hotel.externalId)
    trackChange('description', args.description, hotel.description)
    trackChange('category', args.category, hotel.category)
    trackChange('tags', args.tags, hotel.tags)
    trackChange('parkingIncluded', args.parkingIncluded, hotel.parkingIncluded)
    trackChange('rating', args.rating, hotel.rating)
    trackChange('stateProvince', args.stateProvince, hotel.stateProvince)
    trackChange('postalCode', args.postalCode, hotel.postalCode)
    trackChange(
      'lastRenovationDate',
      args.lastRenovationDate,
      hotel.lastRenovationDate,
    )
    trackChange('metadata', args.metadata, hotel.metadata)

    await ctx.db.patch(args.hotelId, updates)

    // Log the update
    await createAuditLog(ctx, {
      actorId: user._id,
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
    const { user } = await requireHotelManagement(ctx, args.clerkUserId, args.hotelId)

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
      actorId: user._id,
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
    const { user } = await requireHotelManagement(ctx, args.clerkUserId, args.hotelId)

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
      actorId: user._id,
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
