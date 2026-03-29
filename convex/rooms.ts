import { ConvexError, v } from 'convex/values'
import { MutationCtx, QueryCtx, mutation, query } from './_generated/server'
import { requireHotelAccess } from './lib/auth'
import { createAuditLog } from './audit'
import { datesOverlap, isHoldExpired } from './lib/dates'
import { Doc, Id } from './_generated/dataModel'

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

const markUploadAssigned = async (
  ctx: MutationCtx,
  uploadedBy: Id<'users'>,
  storageId: Id<'_storage'>,
  resourceId: Id<'rooms'>,
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
      resourceType: 'room',
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
    resourceType: 'room',
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
      booking.status === 'held' && !isHoldExpired(booking.holdExpiresAt),
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
      rooms = await ctx.db
        .query('rooms')
        .withIndex('by_hotel_and_status', (q) =>
          q.eq('hotelId', args.hotelId).eq('operationalStatus', args.status!),
        )
        .collect()
    } else {
      rooms = await ctx.db
        .query('rooms')
        .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
        .collect()
    }

    // Filter deleted unless explicitly requested
    if (!args.includeDeleted) {
      rooms = rooms.filter((room) => !room.isDeleted)
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

    let rooms = await ctx.db
      .query('rooms')
      .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
      .collect()

    const hotelBookings = await ctx.db
      .query('bookings')
      .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
      .collect()

    const bookingsByRoomId = new Map<
      Id<'rooms'>,
      Array<{ status: string; holdExpiresAt?: number }>
    >()

    for (const booking of hotelBookings) {
      if (['cancelled', 'expired', 'checked_out'].includes(booking.status)) {
        continue
      }

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

    if (!args.includeDeleted) {
      rooms = rooms.filter((room) => !room.isDeleted)
    }

    const roomsWithLiveState = []

    for (const room of rooms) {
      const roomWithImage = await attachRoomImageUrl(ctx, room)
      const activeBookings = bookingsByRoomId.get(room._id) ?? []

      roomsWithLiveState.push({
        ...roomWithImage,
        liveState: getDerivedLiveState(room.operationalStatus, activeBookings),
      })
    }

    return roomsWithLiveState
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
// Uses `datesOverlap` to check for conflicting bookings (active or held, excluding expired holds).
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

    // Get all bookings for this room that could overlap
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_room_and_dates', (q) =>
        q.eq('roomId', args.roomId).lt('checkIn', args.checkOut),
      )
      .collect()

    // Check for overlapping active bookings
    const requestedRange = { checkIn: args.checkIn, checkOut: args.checkOut }

    for (const booking of bookings) {
      // Skip cancelled, expired, or checked_out bookings
      if (['cancelled', 'expired', 'checked_out'].includes(booking.status)) {
        continue
      }

      // Skip expired holds
      if (booking.status === 'held' && isHoldExpired(booking.holdExpiresAt)) {
        continue
      }

      const bookingRange = {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      }

      if (datesOverlap(requestedRange, bookingRange)) {
        return {
          available: false,
          reason: 'Room is already booked for these dates',
        }
      }
    }

    return { available: true }
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

    // Fetch potentially overlapping bookings once per hotel, then group in-memory.
    const requestedRange = { checkIn: args.checkIn, checkOut: args.checkOut }
    const roomIds = new Set(rooms.map((room) => room._id))
    const blockedRoomIds = new Set<Id<'rooms'>>()

    const candidateBookings = await ctx.db
      .query('bookings')
      .withIndex('by_hotel_and_check_in', (q) =>
        q.eq('hotelId', args.hotelId).lt('checkIn', args.checkOut),
      )
      .collect()

    for (const booking of candidateBookings) {
      if (!roomIds.has(booking.roomId)) {
        continue
      }

      // Skip cancelled, expired, or checked_out bookings
      if (['cancelled', 'expired', 'checked_out'].includes(booking.status)) {
        continue
      }

      // Skip expired holds
      if (booking.status === 'held' && isHoldExpired(booking.holdExpiresAt)) {
        continue
      }

      const bookingRange = {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      }

      if (datesOverlap(requestedRange, bookingRange)) {
        blockedRoomIds.add(booking.roomId)
      }
    }

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

    const now = Date.now()
    const roomId = await ctx.db.insert('rooms', {
      hotelId: args.hotelId,
      roomNumber: args.roomNumber,
      type: args.type,
      basePrice: args.basePrice,
      maxOccupancy: args.maxOccupancy,
      operationalStatus: args.operationalStatus ?? 'available',
      amenities: args.amenities,
      description: args.description,
      bedOptions: args.bedOptions,
      smokingAllowed: args.smokingAllowed,
      imageStorageId: args.imageStorageId ?? null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    if (args.imageStorageId) {
      await markUploadAssigned(ctx, user._id, args.imageStorageId, roomId)
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

    if (args.clearImage && args.imageStorageId) {
      throw new ConvexError({
        code: 'INVALID_ARGUMENT',
        message: 'Cannot clear and replace image in the same request.',
      })
    }

    // If changing room number, check for duplicates
    if (args.roomNumber && args.roomNumber !== room.roomNumber) {
      const existingRoom = await ctx.db
        .query('rooms')
        .withIndex('by_hotel_and_room_number', (q) =>
          q.eq('hotelId', room.hotelId).eq('roomNumber', args.roomNumber!),
        )
        .first()

      if (existingRoom && !existingRoom.isDeleted) {
        throw new ConvexError({
          code: 'DUPLICATE',
          message: `Room number ${args.roomNumber} already exists in this hotel.`,
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

    trackChange('roomNumber', args.roomNumber, room.roomNumber)
    trackChange('type', args.type, room.type)
    trackChange('basePrice', args.basePrice, room.basePrice)
    trackChange('maxOccupancy', args.maxOccupancy, room.maxOccupancy)
    trackChange('amenities', args.amenities, room.amenities)
    trackChange('description', args.description, room.description)
    trackChange('bedOptions', args.bedOptions, room.bedOptions)
    trackChange('smokingAllowed', args.smokingAllowed, room.smokingAllowed)

    const shouldUpdateImage =
      args.clearImage || args.imageStorageId !== undefined
    const nextImageStorageId = args.clearImage
      ? null
      : args.imageStorageId !== undefined
        ? args.imageStorageId
        : (room.imageStorageId ?? null)

    if (shouldUpdateImage) {
      previousValues.imageStorageId = room.imageStorageId ?? null
      newValues.imageStorageId = nextImageStorageId
      updates.imageStorageId = nextImageStorageId
    }

    await ctx.db.patch(args.roomId, updates)

    if (shouldUpdateImage) {
      const previousImageStorageId = room.imageStorageId ?? null

      if (
        previousImageStorageId &&
        previousImageStorageId !== nextImageStorageId
      ) {
        await ctx.storage.delete(previousImageStorageId)
        await markUploadDeleted(ctx, user._id, previousImageStorageId)
      }

      if (nextImageStorageId && nextImageStorageId !== previousImageStorageId) {
        await markUploadAssigned(ctx, user._id, nextImageStorageId, args.roomId)
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

    // Check for active bookings
    const activeBookings = await ctx.db
      .query('bookings')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .collect()

    const hasActiveBookings = activeBookings.some(
      (b) =>
        ['held', 'pending_payment', 'confirmed', 'checked_in'].includes(
          b.status,
        ) &&
        !(b.status === 'held' && isHoldExpired(b.holdExpiresAt)),
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
