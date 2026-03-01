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
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

// Status validators
const bookingStatusValidator = v.union(
  v.literal('held'),
  v.literal('pending_payment'),
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

const markUploadAssignedToBooking = async (
  ctx: MutationCtx,
  uploadedBy: Id<'users'>,
  storageId: Id<'_storage'>,
  bookingId: Id<'bookings'>,
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
      resourceType: 'booking',
      resourceId: bookingId,
      uploadedAt: existing.uploadedAt,
      assignedAt: now,
    })
    return
  }

  await ctx.db.insert('fileUploads', {
    storageId,
    uploadedBy,
    status: 'assigned',
    resourceType: 'booking',
    resourceId: bookingId,
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
  transactionId: v.optional(v.string()),
  nationalIdStorageId: v.optional(v.id('_storage')),
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

// Fetches a single booking by its ID.
// Customers can only view their own bookings unless they are hotel staff
// assigned to the hotel where the booking was made.
export const get = query({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.union(bookingValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
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

// Fetches all bookings belonging to a specific user.
// Regular customers can only query their own bookings.
// Room admins can pass any userId to retrieve bookings for that user.
// Optionally filters results by booking status.
export const getByUser = query({
  args: {
    userId: v.optional(v.id('users')), // Admin can query for any user
    status: v.optional(bookingStatusValidator),
  },
  returns: v.array(bookingValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

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

// Fetches all bookings for a hotel along with guest profile and linked user info.
// If hotelId is provided, only hotel staff or room admins with access to that hotel
// can call this. If hotelId is omitted, only room admins can list bookings across all hotels.
// Optionally filters by booking status.
export const getByHotel = query({
  args: {
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
      await requireHotelAccess(ctx, args.hotelId)
    } else {
      const user = await requireUser(ctx)
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

      const linkedUser = booking.userId
        ? await ctx.db.get(booking.userId)
        : null

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

// Fetches all bookings for a specific room.
// Requires hotel access (room admin or assigned hotel staff) for the hotel
// that owns the room. Optionally filters by booking status.
export const getByRoom = query({
  args: {
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

    await requireHotelAccess(ctx, room.hotelId)

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

// Places a temporary hold on a room for a customer (customer role only).
// Creates a booking with 'held' status that automatically expires in 15 minutes
// if not confirmed. Validates dates, checks room availability, prevents date
// conflicts with existing active bookings, and calculates the total price
// based on the room's base price and selected package. Logs the creation as an audit event.
export const holdRoom = mutation({
  args: {
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
    const customer = await requireCustomer(ctx)

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

// Creates an immediate confirmed booking for a walk-in guest (hotel cashier or hotel admin only).
// Unlike holdRoom, this bypasses the hold step and creates the booking directly in
// 'confirmed' status with 'pending' payment. Requires a guest profile to be created
// first. Validates room availability, date conflicts, and package pricing.
// Logs the creation as an audit event.
export const walkInBooking = mutation({
  args: {
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
    const user = await requireUser(ctx)

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
        message:
          'You can only create walk-in bookings for your assigned hotel.',
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

// Confirms a held booking, transitioning it from 'held' to 'confirmed' status.
// Only the customer who owns the booking can confirm it. Verifies that the hold
// has not expired before confirming. Sets paymentStatus to 'pending' as a
// placeholder for payment integration. Logs the status change as an audit event.
export const confirmBooking = mutation({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await requireCustomer(ctx)

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

export const submitPaymentProof = mutation({
  args: {
    bookingId: v.id('bookings'),
    transactionId: v.string(),
    nationalIdStorageId: v.id('_storage'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await requireCustomer(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    if (booking.userId !== customer._id) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You can only submit payment proof for your own booking.',
      })
    }

    if (booking.status !== 'held') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: `Cannot submit payment proof for booking status '${booking.status}'.`,
      })
    }

    if (isHoldExpired(booking.holdExpiresAt)) {
      throw new ConvexError({
        code: 'EXPIRED',
        message: 'Your hold has expired. Please create a new booking.',
      })
    }

    const trimmedTransactionId = args.transactionId.trim()
    if (!trimmedTransactionId) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Transaction ID is required.',
      })
    }

    const previousStorageId = booking.nationalIdStorageId

    await ctx.db.patch(args.bookingId, {
      status: 'pending_payment',
      paymentStatus: 'pending',
      transactionId: trimmedTransactionId,
      nationalIdStorageId: args.nationalIdStorageId,
      updatedAt: Date.now(),
      updatedBy: customer._id,
    })

    await markUploadAssignedToBooking(
      ctx,
      customer._id,
      args.nationalIdStorageId,
      args.bookingId,
    )

    if (
      previousStorageId &&
      previousStorageId !== args.nationalIdStorageId
    ) {
      await ctx.storage.delete(previousStorageId)
      await markUploadDeleted(ctx, customer._id, previousStorageId)
    }

    await createAuditLog(ctx, {
      actorId: customer._id,
      action: 'booking_payment_proof_submitted',
      targetType: 'booking',
      targetId: args.bookingId,
      previousValue: {
        status: booking.status,
      },
      newValue: {
        status: 'pending_payment',
        paymentStatus: 'pending',
        transactionId: trimmedTransactionId,
      },
    })

    return null
  },
})

// Cancels a booking by setting its status to 'cancelled'.
// Customers can cancel their own bookings; hotel staff can cancel bookings
// belonging to their assigned hotel; room admins can cancel any booking.
// Bookings already in 'cancelled', 'expired', 'checked_out', or 'outsourced'
// states cannot be cancelled. Logs the cancellation with an optional reason.
export const cancelBooking = mutation({
  args: {
    bookingId: v.id('bookings'),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

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

// Transitions a booking through its lifecycle statuses (hotel staff and room admin only).
// Enforces allowed state transitions: held→confirmed/cancelled, confirmed→checked_in/cancelled,
// checked_in→checked_out. Other terminal states (checked_out, cancelled, expired, outsourced)
// cannot be transitioned further. Automatically sets paymentStatus to 'pending' when
// confirming a held booking. Logs the status change as an audit event.
export const updateStatus = mutation({
  args: {
    bookingId: v.id('bookings'),
    nextStatus: bookingStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

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
      held: ['cancelled'],
      pending_payment: [],
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

// Marks a booking's payment as 'paid' to record a cash payment (hotel staff and room admin only).
// Idempotent — does nothing if the booking is already marked as paid.
// Cannot be called on cancelled, expired, or outsourced bookings.
// Logs the payment event as an audit record.
export const acceptCashPayment = mutation({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

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

export const verifyPayment = mutation({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    const assignment = await getHotelAssignment(ctx, user._id)
    const isHotelStaffForBooking =
      assignment?.hotelId === booking.hotelId &&
      ['hotel_admin', 'hotel_cashier'].includes(assignment.role)

    if (!isHotelStaffForBooking) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Only assigned hotel cashiers or admins can verify payment.',
      })
    }

    if (booking.status !== 'pending_payment') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: `Cannot verify payment for booking status '${booking.status}'.`,
      })
    }

    await ctx.db.patch(args.bookingId, {
      status: 'confirmed',
      paymentStatus: 'paid',
      updatedAt: Date.now(),
      updatedBy: user._id,
    })

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'booking_payment_verified',
      targetType: 'booking',
      targetId: args.bookingId,
      previousValue: {
        status: booking.status,
        paymentStatus: booking.paymentStatus ?? 'pending',
      },
      newValue: {
        status: 'confirmed',
        paymentStatus: 'paid',
      },
    })

    return null
  },
})

export const rejectPayment = mutation({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    const assignment = await getHotelAssignment(ctx, user._id)
    const isHotelStaffForBooking =
      assignment?.hotelId === booking.hotelId &&
      ['hotel_admin', 'hotel_cashier'].includes(assignment.role)

    if (!isHotelStaffForBooking) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Only assigned hotel cashiers or admins can reject payment.',
      })
    }

    if (booking.status !== 'pending_payment') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: `Cannot reject payment for booking status '${booking.status}'.`,
      })
    }

    const now = Date.now()

    await ctx.db.patch(args.bookingId, {
      status: 'cancelled',
      paymentStatus: 'failed',
      nationalIdStorageId: undefined,
      updatedAt: now,
      updatedBy: user._id,
    })

    if (booking.nationalIdStorageId) {
      await ctx.storage.delete(booking.nationalIdStorageId)
      await markUploadDeleted(ctx, user._id, booking.nationalIdStorageId)
    }

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'booking_payment_rejected',
      targetType: 'booking',
      targetId: args.bookingId,
      previousValue: {
        status: booking.status,
        paymentStatus: booking.paymentStatus ?? 'pending',
      },
      newValue: {
        status: 'cancelled',
        paymentStatus: 'failed',
      },
      metadata: {
        nationalIdDeleted: Boolean(booking.nationalIdStorageId),
      },
    })

    return null
  },
})

// Outsources a confirmed or checked-in booking to another hotel (hotel admin/cashier only).
// Room admins are explicitly blocked from using this action. The destination hotel
// must be different from the source hotel and must exist and not be soft-deleted.
// Sets the booking status to 'outsourced' and records the destination hotel ID and timestamp.
// Logs the outsource action as an audit event.
export const outsourceBooking = mutation({
  args: {
    bookingId: v.id('bookings'),
    destinationHotelId: v.id('hotels'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

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

    const access = await requireHotelAccess(ctx, booking.hotelId)
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

// Fetches a single booking enriched with its associated room and hotel details,
// as well as optional guest profile and linked user information.
// Customers can only view their own bookings unless they are hotel staff
// assigned to the booking's hotel. Returns null if the booking, room, or hotel is not found.
export const getEnriched = query({
  args: {
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
    const user = await requireUser(ctx)
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

// Fetches all bookings for the currently authenticated user, enriched with
// the corresponding room (number, type) and hotel (name, address, city) data.
// Optionally filters by booking status. Rooms or hotels that no longer exist
// are silently excluded from the result.
export const getMyBookingsEnriched = query({
  args: {
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
    const user = await requireUser(ctx)

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
