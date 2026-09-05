import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireHotelAccess } from './lib/auth'
import { createAuditLog } from './audit'
import { hasHoldReleasedRoom } from './lib/dates'
import { checkRoomAvailability, findBlockedRoomIds } from './lib/availability'
import { trimAndCap } from './lib/validation'
import * as fileTracking from './fileTracking'
import { r2 } from './r2'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

// Room type validator
const roomTypeValidator = v.union(
  v.literal('budget'),
  v.literal('standard'),
  v.literal('suite'),
  v.literal('deluxe'),
)

// Operational status validator
const operationalStatusValidator = v.union(
  v.literal('available'),
  v.literal('maintenance'),
  v.literal('cleaning'),
  v.literal('out_of_order'),
)

const roomLiveStateValidator = v.union(
  v.literal('available'),
  v.literal('maintenance'),
  v.literal('cleaning'),
  v.literal('out_of_order'),
  v.literal('held'),
  v.literal('booked'),
)

// Room document validator for return types
const roomValidator = v.object({
  _id: v.id('rooms'),
  _creationTime: v.number(),
  hotelId: v.id('hotels'),
  roomNumber: v.string(),
  type: roomTypeValidator,
  basePrice: v.number(),
  maxOccupancy: v.number(),
  operationalStatus: operationalStatusValidator,
  amenities: v.optional(v.array(v.string())),
  // New fields
  description: v.optional(v.string()),
  bedOptions: v.optional(v.string()),
  smokingAllowed: v.optional(v.boolean()),
  imageStorageId: v.optional(v.union(v.id('_storage'), v.null())),
  imageR2Key: v.optional(v.union(v.string(), v.null())),
  isDeleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

const roomWithImageValidator = roomValidator.extend({
  imageUrl: v.optional(v.string()),
})

const roomWithLiveStateValidator = roomWithImageValidator.extend({
  liveState: roomLiveStateValidator,
})

const attachRoomImageUrl = async (
  ctx: QueryCtx,
  room: Doc<'rooms'>,
): Promise<Doc<'rooms'> & { imageUrl?: string }> => {
  if (room.imageR2Key) {
    return {
      ...room,
      imageUrl: await r2.getUrl(room.imageR2Key, { expiresIn: 60 * 60 }),
    }
  }

  if (!room.imageStorageId) {
    return room
  }

  const imageUrl = await ctx.storage.getUrl(room.imageStorageId)
  if (!imageUrl) {
    return room
  }

  return {
    ...room,
    imageUrl,
  }
}

function getDerivedLiveState(
  operationalStatus: 'available' | 'maintenance' | 'cleaning' | 'out_of_order',
  bookings: Array<{ status: string; holdExpiresAt?: number }>,
):
  | 'available'
  | 'maintenance'
  | 'cleaning'
  | 'out_of_order'
  | 'held'
  | 'booked' {
  if (operationalStatus !== 'available') {
    return operationalStatus
  }

  const hasBooked = bookings.some((booking) =>
    ['pending_payment', 'confirmed', 'checked_in'].includes(booking.status),
  )

  if (hasBooked) {
    return 'booked'
  }

  const hasHeld = bookings.some(
    (booking) =>
      booking.status === 'held' && !hasHoldReleasedRoom(booking.holdExpiresAt),
  )

  if (hasHeld) {
    return 'held'
  }

  return 'available'
}

// Retrieves all rooms for a specified hotel, optionally filtering by operational status.
// Soft-deleted rooms are excluded by default unless includeDeleted is explicitly set to true.
// Enriches each returned room with its associated image URL from storage.
export const getByHotel = query({
  args: {
    hotelId: v.id('hotels'),
    status: v.optional(operationalStatusValidator),
    includeDeleted: v.optional(v.boolean()),
  },
  returns: v.array(roomWithImageValidator),
  handler: async (ctx, args) => {
    let rooms

    if (args.status) {
      // Status filter: use by_hotel_and_status, then filter isDeleted in memory
      // (no 3-column compound index exists for hotelId+operationalStatus+isDeleted)
      rooms = await ctx.db
        .query('rooms')
        .withIndex('by_hotel_and_status', (q) =>
          q.eq('hotelId', args.hotelId).eq('operationalStatus', args.status!),
        )
        .take(500)
      if (!args.includeDeleted) {
        rooms = rooms.filter((room) => !room.isDeleted)
      }
    } else if (!args.includeDeleted) {
      // Efficient: use compound index to only fetch non-deleted rooms
      rooms = await ctx.db
        .query('rooms')
        .withIndex('by_hotel_and_is_deleted', (q) =>
          q.eq('hotelId', args.hotelId).eq('isDeleted', false),
        )
        .take(500)
    } else {
      rooms = await ctx.db
        .query('rooms')
        .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
        .take(500)
    }

    return await Promise.all(rooms.map((room) => attachRoomImageUrl(ctx, room)))
  },
})

// Retrieves all rooms for a hotel along with a derived 'liveState' field based on
// current operational status and active bookings. Requires room admin or hotel staff access.
// Soft-deleted rooms are excluded by default unless includeDeleted is explicitly set to true.
// Enriches each returned room with its associated image URL from storage.
export const getByHotelWithLiveState = query({
  args: {
    hotelId: v.id('hotels'),
    includeDeleted: v.optional(v.boolean()),
  },
  returns: v.array(roomWithLiveStateValidator),
  handler: async (ctx, args) => {
    await requireHotelAccess(ctx, args.hotelId)

    // Use compound index to skip deleted rooms when not requested
    const rooms = args.includeDeleted
      ? await ctx.db
          .query('rooms')
          .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
          .take(500)
      : await ctx.db
          .query('rooms')
          .withIndex('by_hotel_and_is_deleted', (q) =>
            q.eq('hotelId', args.hotelId).eq('isDeleted', false),
          )
          .take(500)

    // Live state only depends on these four statuses (getDerivedLiveState),
    // so fetch just those instead of the hotel's entire booking history.
    const liveStatuses = [
      'held',
      'pending_payment',
      'confirmed',
      'checked_in',
    ] as const
    const hotelBookings = (
      await Promise.all(
        liveStatuses.map((status) =>
          ctx.db
            .query('bookings')
            .withIndex('by_hotel_and_status', (q) =>
              q.eq('hotelId', args.hotelId).eq('status', status),
            )
            .collect(),
        ),
      )
    ).flat()

    const bookingsByRoomId = new Map<
      Id<'rooms'>,
      Array<{ status: string; holdExpiresAt?: number }>
    >()

    for (const booking of hotelBookings) {
      const roomBookings = bookingsByRoomId.get(booking.roomId)
      const liveBooking = {
        status: booking.status,
        holdExpiresAt: booking.holdExpiresAt,
      }

      if (roomBookings) {
        roomBookings.push(liveBooking)
      } else {
        bookingsByRoomId.set(booking.roomId, [liveBooking])
      }
    }

    return await Promise.all(
      rooms.map(async (room) => {
        const roomWithImage = await attachRoomImageUrl(ctx, room)
        const activeBookings = bookingsByRoomId.get(room._id) ?? []

        return {
          ...roomWithImage,
          liveState: getDerivedLiveState(
            room.operationalStatus,
            activeBookings,
          ),
        }
      }),
    )
  },
})

// Retrieves a single room by its ID, excluding soft-deleted rooms.
// If the room exists and is active, it attaches its image URL from storage.
export const get = query({
  args: {
    roomId: v.id('rooms'),
  },
  returns: v.union(roomWithImageValidator, v.null()),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room || room.isDeleted) {
      return null
    }
    return await attachRoomImageUrl(ctx, room)
  },
})

// Checks whether a specific room is available for booking during a given date range.
// Requires the room to exist, not be soft-deleted, and be in 'available' operational status.
// Delegates conflict detection to checkRoomAvailability in lib/availability.ts.
export const checkAvailability = query({
  args: {
    roomId: v.id('rooms'),
    checkIn: v.string(),
    checkOut: v.string(),
  },
  returns: v.object({
    available: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)

    if (!room || room.isDeleted) {
      return { available: false, reason: 'Room not found' }
    }

    if (room.operationalStatus !== 'available') {
      return {
        available: false,
        reason: `Room is currently ${room.operationalStatus}`,
      }
    }

    return checkRoomAvailability(ctx, args.roomId, {
      checkIn: args.checkIn,
      checkOut: args.checkOut,
    })
  },
})

// Finds all available rooms for a specific hotel within a specific date range.
// Optional filters: room type and minimum occupancy limit.
// Checks against active bookings and active holds, returning a list of available
// rooms enriched with their image URLs.
export const getAvailableRooms = query({
  args: {
    hotelId: v.id('hotels'),
    checkIn: v.string(),
    checkOut: v.string(),
    roomType: v.optional(roomTypeValidator),
    minOccupancy: v.optional(v.number()),
  },
  returns: v.array(roomWithImageValidator),
  handler: async (ctx, args) => {
    // Get all rooms for the hotel
    let rooms = await ctx.db
      .query('rooms')
      .withIndex('by_hotel_and_status', (q) =>
        q.eq('hotelId', args.hotelId).eq('operationalStatus', 'available'),
      )
      .collect()

    // Filter out deleted rooms
    rooms = rooms.filter((room) => !room.isDeleted)

    // Apply room type filter
    if (args.roomType) {
      rooms = rooms.filter((room) => room.type === args.roomType)
    }

    // Apply occupancy filter
    if (args.minOccupancy) {
      rooms = rooms.filter((room) => room.maxOccupancy >= args.minOccupancy!)
    }

    if (rooms.length === 0) {
      return []
    }

    const requestedRange = { checkIn: args.checkIn, checkOut: args.checkOut }
    const roomIds = new Set(rooms.map((room) => room._id))
    const blockedRoomIds = await findBlockedRoomIds(
      ctx,
      args.hotelId,
      roomIds,
      requestedRange,
    )
    const availableRooms = rooms.filter((room) => !blockedRoomIds.has(room._id))

    return await Promise.all(
      availableRooms.map((room) => attachRoomImageUrl(ctx, room)),
    )
  },
})

// Creates a new room in the specified hotel (requires room admin or assigned hotel staff).
// Validates uniqueness of room number within the hotel, positive base price, and occupancy.
// If an imageStorageId is provided, it assigns the uploaded file to the room.
// Logs an audit event of the creation.
export const create = mutation({
  args: {
    hotelId: v.id('hotels'),
    roomNumber: v.string(),
    type: roomTypeValidator,
    basePrice: v.number(),
    maxOccupancy: v.number(),
    operationalStatus: v.optional(operationalStatusValidator),
    amenities: v.optional(v.array(v.string())),
    // New optional fields
    description: v.optional(v.string()),
    bedOptions: v.optional(v.string()),
    smokingAllowed: v.optional(v.boolean()),
    imageStorageId: v.optional(v.id('_storage')),
    imageR2Key: v.optional(v.string()),
  },
  returns: v.id('rooms'),
  handler: async (ctx, args) => {
    const { user } = await requireHotelAccess(ctx, args.hotelId)

    // Verify hotel exists
    const hotel = await ctx.db.get(args.hotelId)
    if (!hotel || hotel.isDeleted) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Hotel not found.',
      })
    }

    // Check for duplicate room number in the same hotel
    const existingRoom = await ctx.db
      .query('rooms')
      .withIndex('by_hotel_and_room_number', (q) =>
        q.eq('hotelId', args.hotelId).eq('roomNumber', args.roomNumber),
      )
      .first()

    if (existingRoom && !existingRoom.isDeleted) {
      throw new ConvexError({
        code: 'DUPLICATE',
        message: `Room number ${args.roomNumber} already exists in this hotel.`,
      })
    }

    // Validate price is positive
    if (args.basePrice <= 0) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Base price must be greater than 0.',
      })
    }

    // Validate occupancy is positive
    if (args.maxOccupancy <= 0) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Max occupancy must be greater than 0.',
      })
    }

    // Trim room text and reject overlong values
    const roomNumber = trimAndCap(args.roomNumber, 50, 'Room number')
    const description = args.description?.trim().slice(0, 2000) || undefined
    const bedOptions = args.bedOptions?.trim().slice(0, 200) || undefined
    if (!roomNumber) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Room number is required.',
      })
    }

    const now = Date.now()
    const roomId = await ctx.db.insert('rooms', {
      hotelId: args.hotelId,
      roomNumber,
      type: args.type,
      basePrice: args.basePrice,
      maxOccupancy: args.maxOccupancy,
      operationalStatus: args.operationalStatus ?? 'available',
      amenities: args.amenities
        ?.map((a) => a.trim().slice(0, 100))
        .filter((a) => a.length > 0),
      description,
      bedOptions,
      smokingAllowed: args.smokingAllowed,
      imageStorageId: args.imageStorageId ?? null,
      imageR2Key: args.imageR2Key ?? null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    if (args.imageStorageId) {
      await fileTracking.assign(ctx, {
        uploadedBy: user._id,
        storageId: args.imageStorageId,
        resourceType: 'room',
        resourceId: roomId,
      })
    }

    if (args.imageR2Key) {
      await fileTracking.assignR2(ctx, {
        uploadedBy: user._id,
        r2Key: args.imageR2Key,
        resourceType: 'room',
        resourceId: roomId,
      })
    }

    // Log the creation
    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'room_created',
      targetType: 'room',
      targetId: roomId,
      newValue: {
        roomNumber: args.roomNumber,
        type: args.type,
        basePrice: args.basePrice,
        hotelId: args.hotelId,
      },
    })

    return roomId
  },
})

// Updates specific properties of a room, validating the room exists and the user
// has appropriate access (room admin or assigned hotel staff).
// Validates duplicate room number within the hotel, positive base price and occupancy.
// Can clear or update the image, handling the file's 'assigned' and 'deleted' state correctly.
// Logs an audit event with previous and new values.
export const update = mutation({
  args: {
    roomId: v.id('rooms'),
    roomNumber: v.optional(v.string()),
    type: v.optional(roomTypeValidator),
    basePrice: v.optional(v.number()),
    maxOccupancy: v.optional(v.number()),
    amenities: v.optional(v.array(v.string())),
    // New optional fields
    description: v.optional(v.string()),
    bedOptions: v.optional(v.string()),
    smokingAllowed: v.optional(v.boolean()),
    imageStorageId: v.optional(v.id('_storage')),
    imageR2Key: v.optional(v.string()),
    clearImage: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Room not found.',
      })
    }

    const { user } = await requireHotelAccess(ctx, room.hotelId)

    if (room.isDeleted) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Cannot update a deleted room.',
      })
    }

    if (
      (args.clearImage && (args.imageStorageId || args.imageR2Key)) ||
      (args.imageStorageId && args.imageR2Key)
    ) {
      throw new ConvexError({
        code: 'INVALID_ARGUMENT',
        message: 'Cannot clear and replace image in the same request.',
      })
    }

    // Cap edited room text the same way as create
    const cappedRoomNumber =
      args.roomNumber === undefined
        ? undefined
        : trimAndCap(args.roomNumber, 50, 'Room number')
    const cappedDescription =
      args.description === undefined
        ? undefined
        : args.description.trim().slice(0, 2000) || undefined
    const cappedBedOptions =
      args.bedOptions === undefined
        ? undefined
        : args.bedOptions.trim().slice(0, 200) || undefined

    // If changing room number, check for duplicates
    if (cappedRoomNumber && cappedRoomNumber !== room.roomNumber) {
      const existingRoom = await ctx.db
        .query('rooms')
        .withIndex('by_hotel_and_room_number', (q) =>
          q.eq('hotelId', room.hotelId).eq('roomNumber', cappedRoomNumber),
        )
        .first()

      if (existingRoom && !existingRoom.isDeleted) {
        throw new ConvexError({
          code: 'DUPLICATE',
          message: `Room number ${cappedRoomNumber} already exists in this hotel.`,
        })
      }
    }

    // Validate price if provided
    if (args.basePrice !== undefined && args.basePrice <= 0) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Base price must be greater than 0.',
      })
    }

    // Validate occupancy if provided
    if (args.maxOccupancy !== undefined && args.maxOccupancy <= 0) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Max occupancy must be greater than 0.',
      })
    }

    // Build update object
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

    trackChange('roomNumber', cappedRoomNumber, room.roomNumber)
    trackChange('type', args.type, room.type)
    trackChange('basePrice', args.basePrice, room.basePrice)
    trackChange('maxOccupancy', args.maxOccupancy, room.maxOccupancy)
    trackChange('amenities', args.amenities, room.amenities)
    trackChange('description', cappedDescription, room.description)
    trackChange('bedOptions', cappedBedOptions, room.bedOptions)
    trackChange('smokingAllowed', args.smokingAllowed, room.smokingAllowed)

    const shouldUpdateImage =
      args.clearImage ||
      args.imageStorageId !== undefined ||
      args.imageR2Key !== undefined
    const nextImageStorageId = args.clearImage
      ? null
      : args.imageR2Key !== undefined
        ? null
        : args.imageStorageId !== undefined
          ? args.imageStorageId
          : (room.imageStorageId ?? null)

    if (shouldUpdateImage) {
      previousValues.imageStorageId = room.imageStorageId ?? null
      newValues.imageStorageId = nextImageStorageId
      updates.imageStorageId = nextImageStorageId
      const nextImageR2Key = args.clearImage
        ? null
        : args.imageR2Key !== undefined
          ? args.imageR2Key
          : null
      previousValues.imageR2Key = room.imageR2Key ?? null
      newValues.imageR2Key = nextImageR2Key
      updates.imageR2Key = nextImageR2Key
    }

    await ctx.db.patch(args.roomId, updates)

    if (shouldUpdateImage) {
      const nextImageR2Key = args.clearImage
        ? null
        : args.imageR2Key !== undefined
          ? args.imageR2Key
          : null
      const previousImageR2Key = room.imageR2Key ?? null
      const previousImageStorageId = room.imageStorageId ?? null

      if (
        previousImageStorageId &&
        previousImageStorageId !== nextImageStorageId
      ) {
        await ctx.storage.delete(previousImageStorageId)
        await fileTracking.markDeleted(ctx, {
          uploadedBy: user._id,
          storageId: previousImageStorageId,
        })
      }

      if (previousImageR2Key && previousImageR2Key !== nextImageR2Key) {
        await r2.deleteObject(ctx, previousImageR2Key)
        await fileTracking.markR2Deleted(ctx, {
          uploadedBy: user._id,
          r2Key: previousImageR2Key,
        })
      }

      if (nextImageStorageId && nextImageStorageId !== previousImageStorageId) {
        await fileTracking.assign(ctx, {
          uploadedBy: user._id,
          storageId: nextImageStorageId,
          resourceType: 'room',
          resourceId: args.roomId,
        })
      }

      if (nextImageR2Key && nextImageR2Key !== previousImageR2Key) {
        await fileTracking.assignR2(ctx, {
          uploadedBy: user._id,
          r2Key: nextImageR2Key,
          resourceType: 'room',
          resourceId: args.roomId,
        })
      }
    }

    // Log the update
    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'room_updated',
      targetType: 'room',
      targetId: args.roomId,
      previousValue: previousValues,
      newValue: newValues,
    })

    return null
  },
})

// Updates the operational status (available, maintenance, cleaning, out_of_order) of a room.
// Handled separately from general updates to ensure consistent logging and easier access.
// Idempotent: skips if the room is already in the requested status. Logs an audit event.
export const updateStatus = mutation({
  args: {
    roomId: v.id('rooms'),
    operationalStatus: operationalStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Room not found.',
      })
    }

    const { user } = await requireHotelAccess(ctx, room.hotelId)

    if (room.isDeleted) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Cannot update status of a deleted room.',
      })
    }

    // Idempotent: skip if already in the desired status
    if (room.operationalStatus === args.operationalStatus) {
      return null
    }

    const previousStatus = room.operationalStatus

    await ctx.db.patch(args.roomId, {
      operationalStatus: args.operationalStatus,
      updatedAt: Date.now(),
    })

    // Always log status changes
    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'room_status_changed',
      targetType: 'room',
      targetId: args.roomId,
      previousValue: { operationalStatus: previousStatus },
      newValue: { operationalStatus: args.operationalStatus },
    })

    return null
  },
})

// Soft deletes a room (room admin or assigned hotel staff).
// Checks for active bookings (held, confirmed, checked_in) and throws an error if any exist.
// Expired holds are ignored. Marks the room as 'isDeleted' and logs an audit event.
// Cannot be called on a deleted room (idempotent).
export const softDelete = mutation({
  args: {
    roomId: v.id('rooms'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Room not found.',
      })
    }

    const { user } = await requireHotelAccess(ctx, room.hotelId)

    if (room.isDeleted) {
      // Already deleted, idempotent operation
      return null
    }

    // Check for active bookings using the status index so the read stays
    // proportional to live bookings, not the room's full history
    const activeBookings = (
      await Promise.all(
        (['held', 'pending_payment', 'confirmed', 'checked_in'] as const).map(
          (status) =>
            ctx.db
              .query('bookings')
              .withIndex('by_room_and_status', (q) =>
                q.eq('roomId', args.roomId).eq('status', status),
              )
              .collect(),
        ),
      )
    ).flat()

    const hasActiveBookings = activeBookings.some(
      (b) => !(b.status === 'held' && hasHoldReleasedRoom(b.holdExpiresAt)),
    )

    if (hasActiveBookings) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Cannot delete room with active bookings.',
      })
    }

    await ctx.db.patch(args.roomId, {
      isDeleted: true,
      updatedAt: Date.now(),
    })

    // Log the deletion
    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'room_deleted',
      targetType: 'room',
      targetId: args.roomId,
      previousValue: { isDeleted: false },
      newValue: { isDeleted: true },
    })

    return null
  },
})

// Restores a soft-deleted room back to active status (room admin or assigned hotel staff).
// Validates that the room actually exists and is deleted before resetting isDeleted to false.
// Logs an audit event of the restoration.
export const restore = mutation({
  args: {
    roomId: v.id('rooms'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Room not found.',
      })
    }

    const { user } = await requireHotelAccess(ctx, room.hotelId)

    if (!room.isDeleted) {
      // Already active, idempotent operation
      return null
    }

    await ctx.db.patch(args.roomId, {
      isDeleted: false,
      updatedAt: Date.now(),
    })

    // Log the restoration
    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'room_restored',
      targetType: 'room',
      targetId: args.roomId,
      previousValue: { isDeleted: true },
      newValue: { isDeleted: false },
    })

    return null
  },
})
