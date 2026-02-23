import { ConvexError, v } from 'convex/values'
import { MutationCtx, QueryCtx, mutation, query } from './_generated/server'
import { Doc, Id } from './_generated/dataModel'
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
  imageStorageId: v.optional(v.union(v.id('_storage'), v.null())),
  isDeleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

const hotelWithImageValidator = hotelValidator.extend({
  imageUrl: v.optional(v.string()),
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
      message:
        'Both latitude and longitude are required when setting location.',
    })
  }

  if (hasLatitude && hasLongitude) {
    return { lat: args.latitude as number, lng: args.longitude as number }
  }

  return undefined
}

const attachHotelImageUrl = async (
  ctx: QueryCtx,
  hotel: Doc<'hotels'>,
): Promise<Doc<'hotels'> & { imageUrl?: string }> => {
  if (!hotel.imageStorageId) {
    return hotel
  }

  const imageUrl = await ctx.storage.getUrl(hotel.imageStorageId)
  if (!imageUrl) {
    return hotel
  }

  return {
    ...hotel,
    imageUrl,
  }
}

const markUploadAssigned = async (
  ctx: MutationCtx,
  uploadedBy: Id<'users'>,
  storageId: Id<'_storage'>,
  resourceId: Id<'hotels'>,
) => {
  const existing = await ctx.db
    .query('fileUploads')
    .withIndex('by_storage_id', (q) => q.eq('storageId', storageId))
    .unique()
  const now = Date.now()

  if (existing) {
    await ctx.db.replace(existing._id, {
      storageId,
      uploadedBy,
      status: 'assigned',
      resourceType: 'hotel',
      resourceId,
      uploadedAt: existing.uploadedAt,
      assignedAt: now,
    })
    return
  }

  await ctx.db.insert('fileUploads', {
    storageId,
    uploadedBy,
    status: 'assigned',
    resourceType: 'hotel',
    resourceId,
    uploadedAt: now,
    assignedAt: now,
  })
}

const markUploadDeleted = async (
  ctx: MutationCtx,
  uploadedBy: Id<'users'>,
  storageId: Id<'_storage'>,
) => {
  const existing = await ctx.db
    .query('fileUploads')
    .withIndex('by_storage_id', (q) => q.eq('storageId', storageId))
    .unique()
  const now = Date.now()

  if (existing) {
    await ctx.db.replace(existing._id, {
      storageId,
      uploadedBy,
      status: 'deleted',
      uploadedAt: existing.uploadedAt,
      deletedAt: now,
    })
    return
  }

  await ctx.db.insert('fileUploads', {
    storageId,
    uploadedBy,
    status: 'deleted',
    uploadedAt: now,
    deletedAt: now,
  })
}

// Fetches a list of all active hotels, optionally including soft-deleted ones.
// Each returned hotel is enriched with its image URL from storage if an imageStorageId exists.
export const list = query({
  args: {
    includeDeleted: v.optional(v.boolean()),
  },
  returns: v.array(hotelWithImageValidator),
  handler: async (ctx, args) => {
    let hotels
    if (args.includeDeleted) {
      hotels = await ctx.db.query('hotels').collect()
    } else {
      hotels = await ctx.db
        .query('hotels')
        .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
        .collect()
    }

    return await Promise.all(
      hotels.map((hotel) => attachHotelImageUrl(ctx, hotel)),
    )
  },
})

// Returns an abbreviated list of active hotels specifically for selecting an
// outsource destination for a booking. Requires caller to be authenticated.
// The list excludes the current hotel from the results and sorts alphabetically by name.
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

// Retrieves active hotels matching a specific city name.
// Excludes soft-deleted hotels. Each hotel is enriched with its image URL.
export const getByCity = query({
  args: {
    city: v.string(),
  },
  returns: v.array(hotelWithImageValidator),
  handler: async (ctx, args) => {
    const hotels = await ctx.db
      .query('hotels')
      .withIndex('by_city', (q) => q.eq('city', args.city))
      .collect()

    // Filter out deleted hotels
    return await Promise.all(
      hotels
        .filter((hotel) => !hotel.isDeleted)
        .map((hotel) => attachHotelImageUrl(ctx, hotel)),
    )
  },
})

// Performs a full-text search on hotel names, optionally filtered by city.
// Results are filtered out if they are marked as soft-deleted.
// Each matched hotel is enriched with its associated image URL.
export const search = query({
  args: {
    searchTerm: v.string(),
    city: v.optional(v.string()),
  },
  returns: v.array(hotelWithImageValidator),
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

    const hotels = await searchQuery.collect()
    return await Promise.all(
      hotels.map((hotel) => attachHotelImageUrl(ctx, hotel)),
    )
  },
})

// Retrieves a single hotel's details by its ID.
// Soft-deleted hotels are ignored and return null.
// If the hotel exists, its image URL from storage is attached.
export const get = query({
  args: {
    hotelId: v.id('hotels'),
  },
  returns: v.union(hotelWithImageValidator, v.null()),
  handler: async (ctx, args) => {
    const hotel = await ctx.db.get(args.hotelId)
    if (!hotel || hotel.isDeleted) {
      return null
    }
    return await attachHotelImageUrl(ctx, hotel)
  },
})

// Creates a new hotel record (only callable by a room admin).
// Validates and normalizes latitude and longitude into a structured location object.
// If an imageStorageId is provided, it marks the uploaded file as 'assigned' to this hotel.
// Logs an audit event for the creation.
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
    imageStorageId: v.optional(v.id('_storage')),
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
      imageStorageId: args.imageStorageId ?? null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    if (args.imageStorageId) {
      await markUploadAssigned(ctx, admin._id, args.imageStorageId, hotelId)
    }

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

// Updates specific fields of an existing hotel (requires room admin or hotel_admin role).
// Ensures a soft-deleted hotel cannot be updated. Validates location updates and
// tracks changes to properties for an audit log. Handles clearing or replacing
// the hotel image and updating the associated fileUploads status.
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
    imageStorageId: v.optional(v.id('_storage')),
    clearImage: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireHotelManagement(
      ctx,
      args.clerkUserId,
      args.hotelId,
    )

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

    if (args.clearImage && args.imageStorageId) {
      throw new ConvexError({
        code: 'INVALID_ARGUMENT',
        message: 'Cannot clear and replace image in the same request.',
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

    const shouldUpdateImage =
      args.clearImage || args.imageStorageId !== undefined
    const nextImageStorageId = args.clearImage
      ? null
      : args.imageStorageId !== undefined
        ? args.imageStorageId
        : (hotel.imageStorageId ?? null)

    if (shouldUpdateImage) {
      previousValues.imageStorageId = hotel.imageStorageId ?? null
      newValues.imageStorageId = nextImageStorageId
      updates.imageStorageId = nextImageStorageId
    }

    await ctx.db.patch(args.hotelId, updates)

    if (shouldUpdateImage) {
      const previousImageStorageId = hotel.imageStorageId ?? null
      if (
        previousImageStorageId &&
        previousImageStorageId !== nextImageStorageId
      ) {
        await ctx.storage.delete(previousImageStorageId)
        await markUploadDeleted(ctx, user._id, previousImageStorageId)
      }

      if (nextImageStorageId && nextImageStorageId !== previousImageStorageId) {
        await markUploadAssigned(
          ctx,
          user._id,
          nextImageStorageId,
          args.hotelId,
        )
      }
    }

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

// Soft-deletes a hotel (requires room admin or hotel_admin role).
// Ensures the hotel isn't already deleted, then sets isDeleted to true.
// Logs an audit event recording the soft deletion.
export const softDelete = mutation({
  args: {
    clerkUserId: v.string(),
    hotelId: v.id('hotels'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireHotelManagement(
      ctx,
      args.clerkUserId,
      args.hotelId,
    )

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

// Restores a soft-deleted hotel back to an active state (requires room admin or hotel_admin role).
// Checks if the hotel is currently deleted and, if so, sets isDeleted to false.
// Logs an audit event recording the restoration.
export const restore = mutation({
  args: {
    clerkUserId: v.string(),
    hotelId: v.id('hotels'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireHotelManagement(
      ctx,
      args.clerkUserId,
      args.hotelId,
    )

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

// Retrieves a unique, sorted list of all cities where active hotels are located.
// This is typically used for filtering dropdowns in the UI.
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

// Retrieves a unique, sorted list of all countries where active hotels are located.
// Used for displaying available country filters.
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
