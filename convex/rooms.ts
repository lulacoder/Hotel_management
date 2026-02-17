import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { ConvexError } from 'convex/values'
import { requireHotelAccess } from './lib/auth'
import { createAuditLog } from './audit'
import { datesOverlap, isHoldExpired } from './lib/dates'

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
  isDeleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

// Get rooms by hotel
export const getByHotel = query({
  args: {
    hotelId: v.id('hotels'),
    status: v.optional(operationalStatusValidator),
    includeDeleted: v.optional(v.boolean()),
  },
  returns: v.array(roomValidator),
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

    return rooms
  },
})

// Get a single room by ID
export const get = query({
  args: {
    roomId: v.id('rooms'),
  },
  returns: v.union(roomValidator, v.null()),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room || room.isDeleted) {
      return null
    }
    return room
  },
})

// Check availability for a specific room and date range
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
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
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

// Get available rooms for a hotel within a date range
export const getAvailableRooms = query({
  args: {
    hotelId: v.id('hotels'),
    checkIn: v.string(),
    checkOut: v.string(),
    roomType: v.optional(roomTypeValidator),
    minOccupancy: v.optional(v.number()),
  },
  returns: v.array(roomValidator),
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

    // Get all bookings for these rooms
    const requestedRange = { checkIn: args.checkIn, checkOut: args.checkOut }
    const availableRooms = []

    for (const room of rooms) {
      const bookings = await ctx.db
        .query('bookings')
        .withIndex('by_room', (q) => q.eq('roomId', room._id))
        .collect()

      let isAvailable = true

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
          isAvailable = false
          break
        }
      }

      if (isAvailable) {
        availableRooms.push(room)
      }
    }

    return availableRooms
  },
})

// Create a new room (room admin or assigned hotel staff)
export const create = mutation({
  args: {
    clerkUserId: v.string(),
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
  },
  returns: v.id('rooms'),
  handler: async (ctx, args) => {
    const { user } = await requireHotelAccess(ctx, args.clerkUserId, args.hotelId)

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
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

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

// Update a room (room admin or assigned hotel staff)
export const update = mutation({
  args: {
    clerkUserId: v.string(),
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

    const { user } = await requireHotelAccess(ctx, args.clerkUserId, room.hotelId)

    if (room.isDeleted) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Cannot update a deleted room.',
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

    await ctx.db.patch(args.roomId, updates)

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

// Update room operational status (room admin or assigned hotel staff) - separate function for clarity
export const updateStatus = mutation({
  args: {
    clerkUserId: v.string(),
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

    const { user } = await requireHotelAccess(ctx, args.clerkUserId, room.hotelId)

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

// Soft delete a room (room admin or assigned hotel staff)
export const softDelete = mutation({
  args: {
    clerkUserId: v.string(),
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

    const { user } = await requireHotelAccess(ctx, args.clerkUserId, room.hotelId)

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
        ['held', 'confirmed', 'checked_in'].includes(b.status) &&
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

// Restore a soft-deleted room (room admin or assigned hotel staff)
export const restore = mutation({
  args: {
    clerkUserId: v.string(),
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

    const { user } = await requireHotelAccess(ctx, args.clerkUserId, room.hotelId)

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
