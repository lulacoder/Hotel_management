import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  getHotelAssignment,
  requireCustomer,
  requireHotelAccess,
  requireUser,
} from './lib/auth'
import { createAuditLog } from './audit'
import {
  datesOverlap,
  getHoldExpirationTime,
  isHoldExpired,
  validateBookingDates,
} from './lib/dates'

// Status validators
const bookingStatusValidator = v.union(
  v.literal('held'),
  v.literal('confirmed'),
  v.literal('checked_in'),
  v.literal('checked_out'),
  v.literal('cancelled'),
  v.literal('expired'),
  v.literal('outsourced'),
)

const paymentStatusValidator = v.union(
  v.literal('pending'),
  v.literal('paid'),
  v.literal('failed'),
  v.literal('refunded'),
)

const packageTypeValidator = v.union(
  v.literal('room_only'),
  v.literal('with_breakfast'),
  v.literal('full_package'),
)

const packageAddOnByType = {
  room_only: 0,
  with_breakfast: 1500,
  full_package: 4000,
} as const

// Booking document validator for return types
const bookingValidator = v.object({
  _id: v.id('bookings'),
  _creationTime: v.number(),
  userId: v.optional(v.id('users')),
  guestProfileId: v.optional(v.id('guestProfiles')),
  roomId: v.id('rooms'),
  hotelId: v.id('hotels'),
  checkIn: v.string(),
  checkOut: v.string(),
  status: bookingStatusValidator,
  holdExpiresAt: v.optional(v.number()),
  outsourcedToHotelId: v.optional(v.id('hotels')),
  outsourcedAt: v.optional(v.number()),
  paymentStatus: v.optional(paymentStatusValidator),
  pricePerNight: v.number(),
  totalPrice: v.number(),
  packageType: v.optional(packageTypeValidator),
  packageAddOn: v.optional(v.number()),
  guestName: v.optional(v.string()),
  guestEmail: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  updatedBy: v.optional(v.id('users')),
})

const guestProfileSummaryValidator = v.object({
  _id: v.id('guestProfiles'),
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  linkedUserId: v.optional(v.id('users')),
})

const linkedUserSummaryValidator = v.object({
  _id: v.id('users'),
  email: v.string(),
})

// Get a single booking
export const get = query({
  args: {
    clerkUserId: v.string(),
    bookingId: v.id('bookings'),
  },
  returns: v.union(bookingValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)
    const booking = await ctx.db.get(args.bookingId)

    if (!booking) {
      return null
    }

    // Customers can only view their own bookings unless they are hotel staff for this booking's hotel
    if (user.role === 'customer' && booking.userId !== user._id) {
      const assignment = await getHotelAssignment(ctx, user._id)
      if (!assignment || assignment.hotelId !== booking.hotelId) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: 'You can only view your own bookings.',
        })
      }
    }

    return booking
  },
})

// Get bookings for a user
export const getByUser = query({
  args: {
    clerkUserId: v.string(),
    userId: v.optional(v.id('users')), // Admin can query for any user
    status: v.optional(bookingStatusValidator),
  },
  returns: v.array(bookingValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)

    // Determine which user's bookings to fetch
    let targetUserId = user._id
    if (args.userId && args.userId !== user._id) {
      // Only admins can view other users' bookings
      if (user.role !== 'room_admin') {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: 'You can only view your own bookings.',
        })
      }
      targetUserId = args.userId
    }

    let bookings = await ctx.db
      .query('bookings')
      .withIndex('by_user', (q) => q.eq('userId', targetUserId))
      .order('desc')
      .collect()

    // Filter by status if provided
    if (args.status) {
      bookings = bookings.filter((b) => b.status === args.status)
    }

    return bookings
  },
})

// Get bookings for a hotel (admin only)
export const getByHotel = query({
  args: {
    clerkUserId: v.string(),
    hotelId: v.optional(v.id('hotels')),
    status: v.optional(bookingStatusValidator),
  },
  returns: v.array(
    v.object({
      booking: bookingValidator,
      guestProfile: v.optional(guestProfileSummaryValidator),
      linkedUser: v.optional(linkedUserSummaryValidator),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.hotelId !== undefined) {
      await requireHotelAccess(ctx, args.clerkUserId, args.hotelId)
    } else {
      const user = await requireUser(ctx, args.clerkUserId)
      if (user.role !== 'room_admin') {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: 'Only room admin can list bookings across all hotels.',
        })
      }
    }

    let bookings =
      args.hotelId !== undefined
        ? await ctx.db
            .query('bookings')
            .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId!))
            .order('desc')
            .collect()
        : await ctx.db.query('bookings').order('desc').collect()

    // Filter by status if provided
    if (args.status) {
      bookings = bookings.filter((b) => b.status === args.status)
    }

    const result = []
    for (const booking of bookings) {
      const guestProfile = booking.guestProfileId
        ? await ctx.db.get(booking.guestProfileId)
        : null

      const linkedUser = booking.userId ? await ctx.db.get(booking.userId) : null

      result.push({
        booking,
        guestProfile: guestProfile
          ? {
              _id: guestProfile._id,
              name: guestProfile.name,
              phone: guestProfile.phone,
              email: guestProfile.email,
              linkedUserId: guestProfile.linkedUserId,
            }
          : undefined,
        linkedUser: linkedUser
          ? {
              _id: linkedUser._id,
              email: linkedUser.email,
            }
          : undefined,
      })
    }

    return result
  },
})

// Get bookings for a room (admin only)
export const getByRoom = query({
  args: {
    clerkUserId: v.string(),
    roomId: v.id('rooms'),
    status: v.optional(bookingStatusValidator),
  },
  returns: v.array(bookingValidator),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Room not found.',
      })
    }

    await requireHotelAccess(ctx, args.clerkUserId, room.hotelId)

    let bookings = await ctx.db
      .query('bookings')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .order('desc')
      .collect()

    // Filter by status if provided
    if (args.status) {
      bookings = bookings.filter((b) => b.status === args.status)
    }

    return bookings
  },
})

// Hold a room (customer only)
// This creates a booking with 'held' status that expires in 15 minutes
export const holdRoom = mutation({
  args: {
    clerkUserId: v.string(),
    roomId: v.id('rooms'),
    checkIn: v.string(),
    checkOut: v.string(),
    packageType: v.optional(packageTypeValidator),
    packageAddOn: v.optional(v.number()),
    guestName: v.optional(v.string()),
    guestEmail: v.optional(v.string()),
    specialRequests: v.optional(v.string()),
  },
  returns: v.id('bookings'),
  handler: async (ctx, args) => {
    const customer = await requireCustomer(ctx, args.clerkUserId)

    // Validate dates
    const { nights } = validateBookingDates(args.checkIn, args.checkOut)

    // Get the room
    const room = await ctx.db.get(args.roomId)
    if (!room || room.isDeleted) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Room not found.',
      })
    }

    if (room.operationalStatus !== 'available') {
      throw new ConvexError({
        code: 'UNAVAILABLE',
        message: `Room is currently ${room.operationalStatus} and cannot be booked.`,
      })
    }

    // Get the hotel
    const hotel = await ctx.db.get(room.hotelId)
    if (!hotel || hotel.isDeleted) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Hotel not found.',
      })
    }

    // Check for overlapping bookings (atomic check)
    const existingBookings = await ctx.db
      .query('bookings')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .collect()

    const requestedRange = { checkIn: args.checkIn, checkOut: args.checkOut }

    for (const booking of existingBookings) {
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
        throw new ConvexError({
          code: 'CONFLICT',
          message:
            'Room is not available for the selected dates. Please choose different dates.',
        })
      }
    }

    const packageType = args.packageType ?? 'room_only'
    const expectedPackageAddOn = packageAddOnByType[packageType]

    if (
      args.packageAddOn !== undefined &&
      args.packageAddOn !== expectedPackageAddOn
    ) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Invalid package pricing selected. Please try again.',
      })
    }

    // Calculate pricing
    const pricePerNight = room.basePrice
    const packageAddOn = expectedPackageAddOn
    const totalPrice = (pricePerNight + packageAddOn) * nights

    const now = Date.now()
    const bookingId = await ctx.db.insert('bookings', {
      userId: customer._id,
      roomId: args.roomId,
      hotelId: room.hotelId,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      status: 'held',
      holdExpiresAt: getHoldExpirationTime(),
      pricePerNight,
      packageType,
      packageAddOn,
      totalPrice,
      guestName: args.guestName,
      guestEmail: args.guestEmail,
      specialRequests: args.specialRequests,
      createdAt: now,
      updatedAt: now,
    })

    // Log the booking creation
    await createAuditLog(ctx, {
      actorId: customer._id,
      action: 'booking_created',
      targetType: 'booking',
      targetId: bookingId,
      newValue: {
        status: 'held',
        roomId: args.roomId,
        checkIn: args.checkIn,
        checkOut: args.checkOut,
        packageType,
        packageAddOn,
        totalPrice,
      },
    })

    return bookingId
  },
})

// Create a walk-in booking (hotel cashier/hotel admin only)
export const walkInBooking = mutation({
  args: {
    clerkUserId: v.string(),
    guestProfileId: v.id('guestProfiles'),
    roomId: v.id('rooms'),
    checkIn: v.string(),
    checkOut: v.string(),
    packageType: packageTypeValidator,
    packageAddOn: v.optional(v.number()),
    specialRequests: v.optional(v.string()),
  },
  returns: v.id('bookings'),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)

    const assignment = await getHotelAssignment(ctx, user._id)
    const isAllowedStaff =
      assignment && ['hotel_admin', 'hotel_cashier'].includes(assignment.role)

    if (!isAllowedStaff) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message:
          'Only hotel cashiers and hotel admins can create walk-in bookings.',
      })
    }

    const guestProfile = await ctx.db.get(args.guestProfileId)
    if (!guestProfile) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Guest profile not found.',
      })
    }

    const { nights } = validateBookingDates(args.checkIn, args.checkOut)

    const room = await ctx.db.get(args.roomId)
    if (!room || room.isDeleted) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Room not found.',
      })
    }

    if (assignment.hotelId !== room.hotelId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You can only create walk-in bookings for your assigned hotel.',
      })
    }

    if (room.operationalStatus !== 'available') {
      throw new ConvexError({
        code: 'UNAVAILABLE',
        message: `Room is currently ${room.operationalStatus} and cannot be booked.`,
      })
    }

    const existingBookings = await ctx.db
      .query('bookings')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .collect()

    const requestedRange = { checkIn: args.checkIn, checkOut: args.checkOut }

    for (const booking of existingBookings) {
      if (['cancelled', 'expired', 'checked_out'].includes(booking.status)) {
        continue
      }

      if (booking.status === 'held' && isHoldExpired(booking.holdExpiresAt)) {
        continue
      }

      const bookingRange = {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      }

      if (datesOverlap(requestedRange, bookingRange)) {
        throw new ConvexError({
          code: 'CONFLICT',
          message:
            'Room is not available for the selected dates. Please choose different dates.',
        })
      }
    }

    const expectedPackageAddOn = packageAddOnByType[args.packageType]

    if (
      args.packageAddOn !== undefined &&
      args.packageAddOn !== expectedPackageAddOn
    ) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Invalid package pricing selected. Please try again.',
      })
    }

    const pricePerNight = room.basePrice
    const packageAddOn = expectedPackageAddOn
    const totalPrice = (pricePerNight + packageAddOn) * nights
    const now = Date.now()

    const bookingId = await ctx.db.insert('bookings', {
      userId: guestProfile.linkedUserId,
      guestProfileId: guestProfile._id,
      roomId: args.roomId,
      hotelId: room.hotelId,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      status: 'confirmed',
      paymentStatus: 'pending',
      pricePerNight,
      packageType: args.packageType,
      packageAddOn,
      totalPrice,
      guestName: guestProfile.name,
      guestEmail: guestProfile.email,
      specialRequests: args.specialRequests,
      createdAt: now,
      updatedAt: now,
      updatedBy: user._id,
    })

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'walk_in_booking_created',
      targetType: 'booking',
      targetId: bookingId,
      newValue: {
        status: 'confirmed',
        roomId: args.roomId,
        checkIn: args.checkIn,
        checkOut: args.checkOut,
        packageType: args.packageType,
        packageAddOn,
        totalPrice,
        guestProfileId: args.guestProfileId,
      },
    })

    return bookingId
  },
})

// Confirm a booking (customer only - their own booking)
export const confirmBooking = mutation({
  args: {
    clerkUserId: v.string(),
    bookingId: v.id('bookings'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await requireCustomer(ctx, args.clerkUserId)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    // Verify ownership
    if (booking.userId !== customer._id) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You can only confirm your own bookings.',
      })
    }

    // Verify booking is in held status
    if (booking.status !== 'held') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: `Cannot confirm booking with status '${booking.status}'. Only held bookings can be confirmed.`,
      })
    }

    // Check if hold has expired
    if (isHoldExpired(booking.holdExpiresAt)) {
      throw new ConvexError({
        code: 'EXPIRED',
        message: 'Your hold has expired. Please create a new booking.',
      })
    }

    const previousStatus = booking.status

    await ctx.db.patch(args.bookingId, {
      status: 'confirmed',
      paymentStatus: 'pending', // Stub for payment integration
      holdExpiresAt: undefined, // Clear hold expiration
      updatedAt: Date.now(),
      updatedBy: customer._id,
    })

    // Log the status change
    await createAuditLog(ctx, {
      actorId: customer._id,
      action: 'booking_confirmed',
      targetType: 'booking',
      targetId: args.bookingId,
      previousValue: { status: previousStatus },
      newValue: { status: 'confirmed', paymentStatus: 'pending' },
    })

    return null
  },
})

// Cancel a booking (customer can cancel own, admin can cancel any)
export const cancelBooking = mutation({
  args: {
    clerkUserId: v.string(),
    bookingId: v.id('bookings'),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    const assignment = await getHotelAssignment(ctx, user._id)
    const canCancelAsHotelStaff = assignment?.hotelId === booking.hotelId
    const canCancelAny = user.role === 'room_admin' || canCancelAsHotelStaff
    const canCancelOwn = booking.userId === user._id

    if (!canCancelAny && !canCancelOwn) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to cancel this booking.',
      })
    }

    // Cannot cancel already cancelled or expired bookings
    if (['cancelled', 'expired'].includes(booking.status)) {
      // Idempotent - already in terminal state
      return null
    }

    // Cannot cancel checked_out or outsourced bookings
    if (booking.status === 'checked_out' || booking.status === 'outsourced') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Cannot cancel a completed booking.',
      })
    }

    const previousStatus = booking.status

    await ctx.db.patch(args.bookingId, {
      status: 'cancelled',
      updatedAt: Date.now(),
      updatedBy: user._id,
    })

    // Log the cancellation
    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'booking_cancelled',
      targetType: 'booking',
      targetId: args.bookingId,
      previousValue: { status: previousStatus },
      newValue: { status: 'cancelled' },
      metadata: args.reason ? { reason: args.reason } : undefined,
    })

    return null
  },
})

// Update booking status (hotel staff and room admin)
export const updateStatus = mutation({
  args: {
    clerkUserId: v.string(),
    bookingId: v.id('bookings'),
    nextStatus: bookingStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    const assignment = await getHotelAssignment(ctx, user._id)
    const canManageAsHotelStaff = assignment?.hotelId === booking.hotelId
    const canManage = user.role === 'room_admin' || canManageAsHotelStaff

    if (!canManage) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to update this booking status.',
      })
    }

    if (booking.status === args.nextStatus) {
      return null
    }

    const allowedTransitions: Record<string, Array<string>> = {
      held: ['confirmed', 'cancelled'],
      confirmed: ['checked_in', 'cancelled'],
      checked_in: ['checked_out'],
      checked_out: [],
      cancelled: [],
      expired: [],
      outsourced: [],
    }

    const allowedNextStatuses = allowedTransitions[booking.status] ?? []
    if (!allowedNextStatuses.includes(args.nextStatus)) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: `Cannot transition booking from '${booking.status}' to '${args.nextStatus}'.`,
      })
    }

    const patchData: {
      status: typeof args.nextStatus
      updatedAt: number
      updatedBy: typeof user._id
      holdExpiresAt?: undefined
      paymentStatus?: 'pending'
    } = {
      status: args.nextStatus,
      updatedAt: Date.now(),
      updatedBy: user._id,
    }

    if (booking.status === 'held' && args.nextStatus === 'confirmed') {
      patchData.holdExpiresAt = undefined
      if (!booking.paymentStatus) {
        patchData.paymentStatus = 'pending'
      }
    }

    await ctx.db.patch(args.bookingId, patchData)

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'booking_status_updated',
      targetType: 'booking',
      targetId: args.bookingId,
      previousValue: { status: booking.status },
      newValue: { status: args.nextStatus },
    })

    return null
  },
})

// Accept cash payment (hotel staff and room admin)
export const acceptCashPayment = mutation({
  args: {
    clerkUserId: v.string(),
    bookingId: v.id('bookings'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    const assignment = await getHotelAssignment(ctx, user._id)
    const canManageAsHotelStaff = assignment?.hotelId === booking.hotelId
    const canManage = user.role === 'room_admin' || canManageAsHotelStaff

    if (!canManage) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to update payment status.',
      })
    }

    if (booking.paymentStatus === 'paid') {
      return null
    }

    if (
      booking.status === 'cancelled' ||
      booking.status === 'expired' ||
      booking.status === 'outsourced'
    ) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message:
          'Cannot accept payment for cancelled, expired, or outsourced bookings.',
      })
    }

    await ctx.db.patch(args.bookingId, {
      paymentStatus: 'paid',
      updatedAt: Date.now(),
      updatedBy: user._id,
    })

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'booking_payment_paid_cash',
      targetType: 'booking',
      targetId: args.bookingId,
      previousValue: { paymentStatus: booking.paymentStatus ?? 'pending' },
      newValue: { paymentStatus: 'paid' },
    })

    return null
  },
})

// Outsource a booking to another hotel (hotel admin/cashier only)
export const outsourceBooking = mutation({
  args: {
    clerkUserId: v.string(),
    bookingId: v.id('bookings'),
    destinationHotelId: v.id('hotels'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)

    if (user.role === 'room_admin') {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Room admins cannot outsource bookings.',
      })
    }

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    const access = await requireHotelAccess(ctx, args.clerkUserId, booking.hotelId)
    const assignment = access.assignment
    const isAllowedRole =
      assignment && ['hotel_admin', 'hotel_cashier'].includes(assignment.role)

    if (!isAllowedRole) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Only hotel admins and hotel cashiers can outsource bookings.',
      })
    }

    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Only confirmed or checked-in bookings can be outsourced.',
      })
    }

    if (args.destinationHotelId === booking.hotelId) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Destination hotel must be different from source hotel.',
      })
    }

    const destinationHotel = await ctx.db.get(args.destinationHotelId)
    if (!destinationHotel || destinationHotel.isDeleted) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Destination hotel not found.',
      })
    }

    const now = Date.now()
    await ctx.db.patch(args.bookingId, {
      status: 'outsourced',
      outsourcedToHotelId: args.destinationHotelId,
      outsourcedAt: now,
      updatedAt: now,
      updatedBy: user._id,
    })

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'booking_outsourced',
      targetType: 'booking',
      targetId: args.bookingId,
      previousValue: {
        status: booking.status,
      },
      newValue: {
        status: 'outsourced',
        outsourcedToHotelId: args.destinationHotelId,
        outsourcedAt: now,
      },
      metadata: {
        sourceHotelId: booking.hotelId,
      },
    })

    return null
  },
})

// Get booking with enriched data (room and hotel info)
export const getEnriched = query({
  args: {
    clerkUserId: v.string(),
    bookingId: v.id('bookings'),
  },
  returns: v.union(
    v.object({
      booking: bookingValidator,
      guestProfile: v.optional(guestProfileSummaryValidator),
      linkedUser: v.optional(linkedUserSummaryValidator),
      room: v.object({
        _id: v.id('rooms'),
        roomNumber: v.string(),
        type: v.union(
          v.literal('budget'),
          v.literal('standard'),
          v.literal('suite'),
          v.literal('deluxe'),
        ),
      }),
      hotel: v.object({
        _id: v.id('hotels'),
        name: v.string(),
        address: v.string(),
        city: v.string(),
        country: v.string(),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)
    const booking = await ctx.db.get(args.bookingId)

    if (!booking) {
      return null
    }

    // Customers can only view their own bookings unless assigned to the booking's hotel
    if (user.role === 'customer' && booking.userId !== user._id) {
      const assignment = await getHotelAssignment(ctx, user._id)
      if (!assignment || assignment.hotelId !== booking.hotelId) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: 'You can only view your own bookings.',
        })
      }
    }

    const room = await ctx.db.get(booking.roomId)
    const hotel = await ctx.db.get(booking.hotelId)
    const guestProfile = booking.guestProfileId
      ? await ctx.db.get(booking.guestProfileId)
      : null
    const linkedUser = booking.userId ? await ctx.db.get(booking.userId) : null

    if (!room || !hotel) {
      return null
    }

    return {
      booking,
      guestProfile: guestProfile
        ? {
            _id: guestProfile._id,
            name: guestProfile.name,
            phone: guestProfile.phone,
            email: guestProfile.email,
            linkedUserId: guestProfile.linkedUserId,
          }
        : undefined,
      linkedUser: linkedUser
        ? {
            _id: linkedUser._id,
            email: linkedUser.email,
          }
        : undefined,
      room: {
        _id: room._id,
        roomNumber: room.roomNumber,
        type: room.type,
      },
      hotel: {
        _id: hotel._id,
        name: hotel.name,
        address: hotel.address,
        city: hotel.city,
        country: hotel.country,
      },
    }
  },
})

// Get user's bookings with enriched data
export const getMyBookingsEnriched = query({
  args: {
    clerkUserId: v.string(),
    status: v.optional(bookingStatusValidator),
  },
  returns: v.array(
    v.object({
      booking: bookingValidator,
      room: v.object({
        _id: v.id('rooms'),
        roomNumber: v.string(),
        type: v.union(
          v.literal('budget'),
          v.literal('standard'),
          v.literal('suite'),
          v.literal('deluxe'),
        ),
      }),
      hotel: v.object({
        _id: v.id('hotels'),
        name: v.string(),
        address: v.string(),
        city: v.string(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)

    let bookings = await ctx.db
      .query('bookings')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect()

    // Filter by status if provided
    if (args.status) {
      bookings = bookings.filter((b) => b.status === args.status)
    }

    // Enrich with room and hotel data
    const enrichedBookings = []

    for (const booking of bookings) {
      const room = await ctx.db.get(booking.roomId)
      const hotel = await ctx.db.get(booking.hotelId)

      if (room && hotel) {
        enrichedBookings.push({
          booking,
          room: {
            _id: room._id,
            roomNumber: room.roomNumber,
            type: room.type,
          },
          hotel: {
            _id: hotel._id,
            name: hotel.name,
            address: hotel.address,
            city: hotel.city,
          },
        })
      }
    }

    return enrichedBookings
  },
})
