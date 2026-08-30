import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { ConvexError, v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { internal } from './_generated/api'
import {
  getHotelAssignment,
  requireCustomer,
  requireHotelAccess,
  requireHotelManagement,
  requireUser,
} from './lib/auth'
import { uniqueIds } from './lib/arrays'
import { createAuditLog } from './audit'
import {
  getHoldExpirationTime,
  getProofReviewDeadline,
  isHoldExpiredAt,
  validateBookingDates,
} from './lib/dates'
import { assertRoomAvailable } from './lib/availability'
import {
  canApplyBookingTransition,
  isCancelledOrExpiredBookingStatus,
} from './lib/bookingLifecycle'
import { transitionBooking } from './lib/bookingTransitions'
import { transitionRefund } from './lib/refunds'
import * as fileTracking from './fileTracking'
import { r2 } from './r2'

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

const refundStatusValidator = v.union(
  v.literal('required'),
  v.literal('processing'),
  v.literal('refunded'),
  v.literal('reversed'),
  v.literal('verification_required'),
)

const paymentMethodValidator = v.union(
  v.literal('cash'),
  v.literal('bank_transfer'),
  v.literal('chapa'),
)

const refundMethodValidator = v.union(v.literal('chapa'), v.literal('manual'))

const refundReasonValidator = v.union(
  v.literal('late_payment'),
  v.literal('staff_cancelled'),
  v.literal('no_show'),
)

const paymentStatusFilterValidator = v.union(
  paymentStatusValidator,
  v.literal('refund_required'),
  v.literal('unpaid_unknown'),
)

const packageTypeValidator = v.union(
  v.literal('room_only'),
  v.literal('with_breakfast'),
  v.literal('full_package'),
)

const hotelCategoryValidator = v.union(
  v.literal('Boutique'),
  v.literal('Budget'),
  v.literal('Luxury'),
  v.literal('Resort and Spa'),
  v.literal('Extended-Stay'),
  v.literal('Suite'),
)

const chapaPaymentStatusValidator = v.union(
  v.literal('initialized'),
  v.literal('paid'),
  v.literal('failed'),
  v.literal('cancelled'),
  v.literal('refund_required'),
  v.literal('refund_initiated'),
  v.literal('refunded'),
  v.literal('reversed'),
)

const customerPaymentSummaryValidator = v.object({
  _id: v.id('chapaPayments'),
  txRef: v.string(),
  bookingAmountCents: v.number(),
  bookingCurrency: v.literal('USD'),
  chargedAmountMinor: v.number(),
  chargedCurrency: v.literal('ETB'),
  fxRateEtbPerUsd: v.number(),
  status: chapaPaymentStatusValidator,
  checkoutUrl: v.string(),
  paymentMethod: v.optional(v.string()),
  lastError: v.optional(v.string()),
  verifiedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

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
  proofReviewDeadline: v.optional(v.number()),
  outsourcedToHotelId: v.optional(v.id('hotels')),
  outsourcedAt: v.optional(v.number()),
  paymentStatus: v.optional(paymentStatusValidator),
  paymentMethod: v.optional(paymentMethodValidator),
  refundStatus: v.optional(refundStatusValidator),
  refundMethod: v.optional(refundMethodValidator),
  refundReason: v.optional(refundReasonValidator),
  refundActionRequired: v.optional(v.boolean()),
  refundRequiredAt: v.optional(v.number()),
  refundStartedAt: v.optional(v.number()),
  refundCompletedAt: v.optional(v.number()),
  refundLastError: v.optional(v.string()),
  manualRefundReference: v.optional(v.string()),
  transactionId: v.optional(v.string()),
  nationalIdStorageId: v.optional(v.id('_storage')),
  nationalIdR2Key: v.optional(v.string()),
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

const paginatedBookingsValidator = paginationResultValidator(bookingValidator)

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

const bookingWithGuestInfoValidator = v.object({
  booking: bookingValidator,
  guestProfile: v.optional(guestProfileSummaryValidator),
  linkedUser: v.optional(linkedUserSummaryValidator),
})

const enrichedCustomerBookingValidator = v.object({
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
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedBookingsValidator,
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

    // Use compound index when status is provided to avoid in-memory filtering
    return args.status
      ? await ctx.db
          .query('bookings')
          .withIndex('by_user_and_status', (q) =>
            q.eq('userId', targetUserId).eq('status', args.status!),
          )
          .order('desc')
          .paginate(args.paginationOpts)
      : await ctx.db
          .query('bookings')
          .withIndex('by_user', (q) => q.eq('userId', targetUserId))
          .order('desc')
          .paginate(args.paginationOpts)
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
    paymentStatus: v.optional(paymentStatusFilterValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(bookingWithGuestInfoValidator),
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

    const isRefundRequiredFilter = args.paymentStatus === 'refund_required'
    const indexedPaymentStatus =
      args.paymentStatus === 'unpaid_unknown' ||
      args.paymentStatus === 'refund_required'
        ? undefined
        : args.paymentStatus

    // Every filter combination is applied before pagination so a page can
    // never look empty while matching bookings exist behind its cursor.
    const paginatedBookings = isRefundRequiredFilter
      ? args.hotelId
        ? args.status
          ? await ctx.db
              .query('bookings')
              .withIndex('by_hotel_and_refund_action_required', (q) =>
                q.eq('hotelId', args.hotelId!).eq('refundActionRequired', true),
              )
              .filter((q) => q.eq(q.field('status'), args.status!))
              .order('desc')
              .paginate(args.paginationOpts)
          : await ctx.db
              .query('bookings')
              .withIndex('by_hotel_and_refund_action_required', (q) =>
                q.eq('hotelId', args.hotelId!).eq('refundActionRequired', true),
              )
              .order('desc')
              .paginate(args.paginationOpts)
        : args.status
          ? await ctx.db
              .query('bookings')
              .withIndex('by_refund_action_required', (q) =>
                q.eq('refundActionRequired', true),
              )
              .filter((q) => q.eq(q.field('status'), args.status!))
              .order('desc')
              .paginate(args.paginationOpts)
          : await ctx.db
              .query('bookings')
              .withIndex('by_refund_action_required', (q) =>
                q.eq('refundActionRequired', true),
              )
              .order('desc')
              .paginate(args.paginationOpts)
      : args.hotelId
        ? args.status
          ? args.paymentStatus
            ? await ctx.db
                .query('bookings')
                .withIndex('by_hotel_status_and_payment_status', (q) =>
                  q
                    .eq('hotelId', args.hotelId!)
                    .eq('status', args.status!)
                    .eq('paymentStatus', indexedPaymentStatus),
                )
                .order('desc')
                .paginate(args.paginationOpts)
            : await ctx.db
                .query('bookings')
                .withIndex('by_hotel_and_status', (q) =>
                  q.eq('hotelId', args.hotelId!).eq('status', args.status!),
                )
                .order('desc')
                .paginate(args.paginationOpts)
          : args.paymentStatus
            ? await ctx.db
                .query('bookings')
                .withIndex('by_hotel_and_payment_status', (q) =>
                  q
                    .eq('hotelId', args.hotelId!)
                    .eq('paymentStatus', indexedPaymentStatus),
                )
                .order('desc')
                .paginate(args.paginationOpts)
            : await ctx.db
                .query('bookings')
                .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId!))
                .order('desc')
                .paginate(args.paginationOpts)
        : args.status
          ? args.paymentStatus
            ? await ctx.db
                .query('bookings')
                .withIndex('by_status_and_payment_status', (q) =>
                  q
                    .eq('status', args.status!)
                    .eq('paymentStatus', indexedPaymentStatus),
                )
                .order('desc')
                .paginate(args.paginationOpts)
            : await ctx.db
                .query('bookings')
                .withIndex('by_status', (q) => q.eq('status', args.status!))
                .order('desc')
                .paginate(args.paginationOpts)
          : args.paymentStatus
            ? await ctx.db
                .query('bookings')
                .withIndex('by_payment_status', (q) =>
                  q.eq('paymentStatus', indexedPaymentStatus),
                )
                .order('desc')
                .paginate(args.paginationOpts)
            : await ctx.db
                .query('bookings')
                .withIndex('by_created_at')
                .order('desc')
                .paginate(args.paginationOpts)

    const bookings = paginatedBookings.page

    const guestProfileIds = uniqueIds(
      bookings.map((booking) => booking.guestProfileId),
    )
    const linkedUserIds = uniqueIds(bookings.map((booking) => booking.userId))

    const [guestProfiles, linkedUsers] = await Promise.all([
      Promise.all(
        guestProfileIds.map((guestProfileId) => ctx.db.get(guestProfileId)),
      ),
      Promise.all(
        linkedUserIds.map((linkedUserId) => ctx.db.get(linkedUserId)),
      ),
    ])

    const guestProfileMap = new Map(
      guestProfiles
        .filter((guestProfile) => guestProfile !== null)
        .map((guestProfile) => [guestProfile._id, guestProfile]),
    )
    const linkedUserMap = new Map(
      linkedUsers
        .filter((linkedUser) => linkedUser !== null)
        .map((linkedUser) => [linkedUser._id, linkedUser]),
    )

    const page = bookings.map((booking) => {
      const guestProfile = booking.guestProfileId
        ? guestProfileMap.get(booking.guestProfileId)
        : null
      const linkedUser = booking.userId
        ? linkedUserMap.get(booking.userId)
        : null

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
      }
    })

    return {
      ...paginatedBookings,
      page,
    }
  },
})

// Fetches all bookings for a specific room.
// Requires hotel access (room admin or assigned hotel staff) for the hotel
// that owns the room. Optionally filters by booking status.
export const getByRoom = query({
  args: {
    roomId: v.id('rooms'),
    status: v.optional(bookingStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedBookingsValidator,
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Room not found.',
      })
    }

    await requireHotelAccess(ctx, room.hotelId)

    // Use compound index when status is provided to avoid in-memory filtering
    return args.status
      ? await ctx.db
          .query('bookings')
          .withIndex('by_room_and_status', (q) =>
            q.eq('roomId', args.roomId).eq('status', args.status!),
          )
          .order('desc')
          .paginate(args.paginationOpts)
      : await ctx.db
          .query('bookings')
          .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
          .order('desc')
          .paginate(args.paginationOpts)
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

    await assertRoomAvailable(ctx, args.roomId, {
      checkIn: args.checkIn,
      checkOut: args.checkOut,
    })

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

    await assertRoomAvailable(ctx, args.roomId, {
      checkIn: args.checkIn,
      checkOut: args.checkOut,
    })

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

export const submitPaymentProof = mutation({
  args: {
    bookingId: v.id('bookings'),
    transactionId: v.string(),
    nationalIdStorageId: v.optional(v.id('_storage')),
    nationalIdR2Key: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await requireCustomer(ctx)

    if (
      (!args.nationalIdStorageId && !args.nationalIdR2Key) ||
      (args.nationalIdStorageId && args.nationalIdR2Key)
    ) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Submit exactly one national ID image.',
      })
    }

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

    const trimmedTransactionId = args.transactionId.trim()
    if (!trimmedTransactionId) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Transaction ID is required.',
      })
    }

    const previousStorageId = booking.nationalIdStorageId
    const previousR2Key = booking.nationalIdR2Key
    const now = Date.now()

    // Move the proof into staff review and swap the short checkout hold for the
    // longer review deadline, so the room is still reclaimable if nobody answers
    await transitionBooking(ctx, {
      booking,
      event: 'payment_proof_submitted',
      to: 'pending_payment',
      actor: { kind: 'user', userId: customer._id },
      changes: {
        paymentStatus: 'pending',
        holdExpiresAt: undefined,
        proofReviewDeadline: getProofReviewDeadline(now),
        transactionId: trimmedTransactionId,
        nationalIdStorageId: args.nationalIdStorageId,
        nationalIdR2Key: args.nationalIdR2Key,
      },
      now,
    })

    if (args.nationalIdStorageId) {
      await fileTracking.assign(ctx, {
        uploadedBy: customer._id,
        storageId: args.nationalIdStorageId,
        resourceType: 'booking',
        resourceId: args.bookingId,
      })
    }

    if (args.nationalIdR2Key) {
      await fileTracking.assignR2(ctx, {
        uploadedBy: customer._id,
        r2Key: args.nationalIdR2Key,
        resourceType: 'booking',
        resourceId: args.bookingId,
      })
    }

    if (previousStorageId && previousStorageId !== args.nationalIdStorageId) {
      await ctx.storage.delete(previousStorageId)
      await fileTracking.markDeleted(ctx, {
        uploadedBy: customer._id,
        storageId: previousStorageId,
      })
    }

    if (previousR2Key && previousR2Key !== args.nationalIdR2Key) {
      await r2.deleteObject(ctx, previousR2Key)
      await fileTracking.markR2Deleted(ctx, {
        uploadedBy: customer._id,
        r2Key: previousR2Key,
      })
    }

    // Notify all hotel staff that a new payment proof is awaiting review.
    await ctx.runMutation(internal.notifications.notifyHotelStaff, {
      hotelId: booking.hotelId,
      type: 'booking_payment_proof_submitted',
      bookingId: args.bookingId,
      message: `New payment proof submitted for booking #${args.bookingId.slice(-6).toUpperCase()} — awaiting your review.`,
    })

    return null
  },
})

// Cancels a booking by setting its status to 'cancelled'.
// Customers can cancel their own bookings; hotel staff can cancel bookings
// belonging to their assigned hotel; room admins can cancel any booking.
// Bookings already in 'cancelled', 'expired', 'checked_in', 'checked_out', or
// 'outsourced' states cannot be cancelled. Paid bookings require a separate
// refund policy before cancellation. Logs the cancellation with an optional reason.
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
    if (isCancelledOrExpiredBookingStatus(booking.status)) {
      // Idempotent - already in terminal state
      return null
    }

    // Cancel through lifecycle rules so paid or checked-in bookings stay protected
    await transitionBooking(ctx, {
      booking,
      event: 'booking_cancelled',
      to: 'cancelled',
      actor: { kind: 'user', userId: user._id },
      changes: { proofReviewDeadline: undefined },
      metadata: args.reason ? { reason: args.reason } : undefined,
    })

    // Notify the booking owner only when a staff member / admin cancels on
    // their behalf, so skip the notification if the customer cancels themselves.
    const cancelledByStaff = user.role === 'room_admin' || canCancelAsHotelStaff
    if (cancelledByStaff && booking.userId) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: booking.userId,
        type: 'booking_cancelled',
        bookingId: args.bookingId,
        hotelId: booking.hotelId,
        message: `Your booking #${args.bookingId.slice(-6).toUpperCase()} has been cancelled${args.reason ? `: ${args.reason}` : '.'}`,
      })
    }

    return null
  },
})

// Lets authorized staff cancel a confirmed paid booking and flag its refund work
export const cancelPaidBooking = mutation({
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
    const canCancelAsHotelAdmin =
      assignment?.hotelId === booking.hotelId &&
      assignment.role === 'hotel_admin'
    const canCancelAsStaff = user.role === 'room_admin' || canCancelAsHotelAdmin

    if (!canCancelAsStaff) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Only authorized hotel staff can cancel a paid booking.',
      })
    }

    if (booking.status === 'cancelled' && booking.refundStatus === 'required') {
      return null
    }

    const now = Date.now()
    const chapaPayment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_booking', (q) => q.eq('bookingId', booking._id))
      .order('desc')
      .filter((q) => q.eq(q.field('status'), 'paid'))
      .first()
    const refundMethod = chapaPayment ? ('chapa' as const) : ('manual' as const)

    // Cancel the stay while keeping the payment paid until a refund is completed
    await transitionBooking(ctx, {
      booking,
      event: 'paid_booking_cancelled',
      to: 'cancelled',
      actor: { kind: 'user', userId: user._id },
      changes: {
        refundStatus: 'required',
        refundMethod,
        refundReason: 'staff_cancelled',
        refundActionRequired: true,
        refundRequiredAt: now,
      },
      metadata: args.reason ? { reason: args.reason } : undefined,
      now,
    })

    // Mirror the refund obligation onto the latest paid Chapa transaction
    if (chapaPayment?.status === 'paid') {
      await ctx.db.patch(chapaPayment._id, {
        status: 'refund_required',
        lastError: 'Booking was cancelled by staff after payment.',
        updatedAt: now,
      })
    }

    // Alert all assigned staff so cashiers can see the task without executing it
    await ctx.runMutation(internal.notifications.notifyHotelStaff, {
      hotelId: booking.hotelId,
      type: 'booking_refund_required',
      bookingId: booking._id,
      message: `Paid booking #${booking._id.slice(-6).toUpperCase()} was cancelled and requires a full ${refundMethod === 'chapa' ? 'Chapa' : 'manual'} refund.`,
    })

    if (booking.userId) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: booking.userId,
        type: 'booking_cancelled',
        bookingId: booking._id,
        hotelId: booking.hotelId,
        message: `Your paid booking #${booking._id.slice(-6).toUpperCase()} was cancelled by the hotel. Your refund will follow${args.reason ? `: ${args.reason}` : '.'}`,
      })
    }

    return null
  },
})

// Applies the staff-only check-in and check-out transitions. Cancellation uses
// cancelBooking so its payment guard, reason, and notification cannot be bypassed.
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

    // Apply the staff check-in or check-out and record who performed it
    await transitionBooking(ctx, {
      booking,
      event: 'staff_status_updated',
      to: args.nextStatus,
      actor: { kind: 'user', userId: user._id },
    })

    return null
  },
})

// Records a cash payment and confirms an active held or pending-payment booking.
// Hotel staff and room admins may also settle an already confirmed or active stay
// without moving it backward. Repeated calls after payment are idempotent.
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

    const shouldConfirmBooking =
      booking.status === 'held' || booking.status === 'pending_payment'
    const nextStatus = shouldConfirmBooking ? 'confirmed' : booking.status

    if (
      booking.paymentStatus === 'paid' &&
      nextStatus === booking.status &&
      booking.holdExpiresAt === undefined &&
      booking.proofReviewDeadline === undefined
    ) {
      return null
    }

    // Mark the payment paid without moving an active stay backward
    await transitionBooking(ctx, {
      booking,
      event: 'cash_payment_accepted',
      to: nextStatus,
      actor: { kind: 'user', userId: user._id },
      changes: {
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        holdExpiresAt: undefined,
        proofReviewDeadline: undefined,
      },
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

    // Confirm the booking, close out its deadlines, and audit the staff approval
    await transitionBooking(ctx, {
      booking,
      event: 'bank_payment_verified',
      to: 'confirmed',
      actor: { kind: 'user', userId: user._id },
      changes: {
        paymentStatus: 'paid',
        paymentMethod: 'bank_transfer',
        holdExpiresAt: undefined,
        proofReviewDeadline: undefined,
      },
    })

    // Notify the customer that their booking is now confirmed.
    if (booking.userId) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: booking.userId,
        type: 'booking_confirmed',
        bookingId: args.bookingId,
        hotelId: booking.hotelId,
        message: `Your booking #${args.bookingId.slice(-6).toUpperCase()} has been confirmed! Payment verified successfully.`,
      })
    }

    try {
      await ctx.runMutation(internal.paymentEmails.sendPaymentSuccessEmails, {
        bookingId: args.bookingId,
        channel: 'bank',
      })
    } catch (error) {
      console.error('Failed to enqueue bank payment success emails:', error)
    }

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

    const now = Date.now()

    // Cancel the booking, fail the payment, and record removal of rejected evidence
    await transitionBooking(ctx, {
      booking,
      event: 'bank_payment_rejected',
      to: 'cancelled',
      actor: { kind: 'user', userId: user._id },
      changes: {
        paymentStatus: 'failed',
        proofReviewDeadline: undefined,
        nationalIdStorageId: undefined,
        nationalIdR2Key: undefined,
      },
      metadata: {
        nationalIdDeleted: Boolean(
          booking.nationalIdStorageId || booking.nationalIdR2Key,
        ),
      },
      now,
    })

    if (booking.nationalIdStorageId) {
      await ctx.storage.delete(booking.nationalIdStorageId)
      await fileTracking.markDeleted(ctx, {
        uploadedBy: user._id,
        storageId: booking.nationalIdStorageId,
      })
    }

    if (booking.nationalIdR2Key) {
      await r2.deleteObject(ctx, booking.nationalIdR2Key)
      await fileTracking.markR2Deleted(ctx, {
        uploadedBy: user._id,
        r2Key: booking.nationalIdR2Key,
      })
    }

    // Notify the customer that their payment was rejected.
    if (booking.userId) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: booking.userId,
        type: 'booking_payment_rejected',
        bookingId: args.bookingId,
        hotelId: booking.hotelId,
        message: `Your payment proof for booking #${args.bookingId.slice(-6).toUpperCase()} was rejected and the booking was cancelled. Please create a new booking to try again.`,
      })
    }

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
    // Complete the source booking as outsourced and record its destination
    await transitionBooking(ctx, {
      booking,
      event: 'booking_outsourced',
      to: 'outsourced',
      actor: { kind: 'user', userId: user._id },
      changes: {
        outsourcedToHotelId: args.destinationHotelId,
        outsourcedAt: now,
      },
      metadata: {
        sourceHotelId: booking.hotelId,
      },
      now,
    })

    return null
  },
})

export const getBookingById = internalQuery({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.union(bookingValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.bookingId)
  },
})

export const confirmChapaPayment = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    chapaReference: v.string(),
  },
  returns: v.union(
    v.literal('confirmed'),
    v.literal('already_confirmed'),
    v.literal('synchronized'),
    v.literal('booking_missing'),
    v.literal('invalid_state'),
    v.literal('expired'),
  ),
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      return 'booking_missing'
    }

    if (booking.status === 'confirmed' && booking.paymentStatus === 'paid') {
      return 'already_confirmed'
    }

    if (booking.status === 'confirmed') {
      // Synchronize Chapa payment details onto an already confirmed booking
      await transitionBooking(ctx, {
        booking,
        event: 'chapa_payment_confirmed',
        to: 'confirmed',
        actor: { kind: 'provider', provider: 'chapa' },
        changes: {
          paymentStatus: 'paid',
          paymentMethod: 'chapa',
          transactionId: args.chapaReference,
          holdExpiresAt: undefined,
        },
      })

      try {
        await ctx.runMutation(internal.paymentEmails.sendPaymentSuccessEmails, {
          bookingId: args.bookingId,
          channel: 'chapa',
        })
      } catch (error) {
        console.error('Failed to enqueue Chapa payment success emails:', error)
      }

      return 'synchronized'
    }

    if (
      !canApplyBookingTransition(
        'chapa_payment_confirmed',
        booking.status,
        'confirmed',
      )
    ) {
      return 'invalid_state'
    }

    const now = Date.now()

    if (isHoldExpiredAt(booking.holdExpiresAt, now)) {
      return 'expired'
    }

    // Confirm the live hold and attribute the payment transition to Chapa
    await transitionBooking(ctx, {
      booking,
      event: 'chapa_payment_confirmed',
      to: 'confirmed',
      actor: { kind: 'provider', provider: 'chapa' },
      changes: {
        paymentStatus: 'paid',
        paymentMethod: 'chapa',
        transactionId: args.chapaReference,
        holdExpiresAt: undefined,
      },
      now,
    })

    if (booking.userId) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: booking.userId,
        type: 'booking_confirmed',
        bookingId: args.bookingId,
        hotelId: booking.hotelId,
        message: `Your booking #${args.bookingId.slice(-6).toUpperCase()} has been confirmed! Payment received successfully via Chapa.`,
      })
    }

    try {
      await ctx.runMutation(internal.paymentEmails.sendPaymentSuccessEmails, {
        bookingId: args.bookingId,
        channel: 'chapa',
      })
    } catch (error) {
      console.error('Failed to enqueue Chapa payment success emails:', error)
    }

    return 'confirmed'
  },
})

export const applyChapaPaymentStatus = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    paymentStatus: v.union(
      v.literal('paid'),
      v.literal('failed'),
      v.literal('refunded'),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      return null
    }

    if (booking.paymentStatus === args.paymentStatus) {
      return null
    }

    const now = Date.now()
    await ctx.db.patch(args.bookingId, {
      paymentStatus: args.paymentStatus,
      ...(args.paymentStatus === 'paid'
        ? { paymentMethod: 'chapa' as const }
        : {}),
      updatedAt: now,
    })

    // Keep provider-driven money changes in the same dispute audit trail
    await createAuditLog(ctx, {
      action: 'booking_chapa_payment_status_updated',
      targetType: 'booking',
      targetId: booking._id,
      previousValue: { paymentStatus: booking.paymentStatus ?? null },
      newValue: { paymentStatus: args.paymentStatus },
      metadata: { actorKind: 'provider', provider: 'chapa' },
    })

    return null
  },
})

// Creates the staff refund task when Chapa charges an unfulfillable booking
export const markChapaRefundRequired = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    txRef: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking || booking.refundStatus) {
      return null
    }

    const now = Date.now()
    // Record that money was captured even though the room could not be confirmed
    await ctx.db.patch(booking._id, {
      paymentStatus: 'paid',
      paymentMethod: 'chapa',
      updatedAt: now,
    })
    const paidBooking = (await ctx.db.get(booking._id))!

    // Open one provider refund task with an immutable business reason
    await transitionRefund(ctx, {
      booking: paidBooking,
      to: 'required',
      method: 'chapa',
      reason: 'late_payment',
      actor: { kind: 'provider', provider: 'chapa' },
      metadata: { txRef: args.txRef },
      now,
    })

    // Alert hotel staff, including cashiers who can monitor but not execute
    await ctx.runMutation(internal.notifications.notifyHotelStaff, {
      hotelId: booking.hotelId,
      type: 'booking_refund_required',
      bookingId: booking._id,
      message: `Chapa charged booking #${booking._id.slice(-6).toUpperCase()} after it could no longer be confirmed. A full refund is required.`,
    })

    if (booking.userId) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: booking.userId,
        type: 'booking_refund_required',
        bookingId: booking._id,
        hotelId: booking.hotelId,
        message: `Your payment for booking #${booking._id.slice(-6).toUpperCase()} arrived after the room was released. The hotel has been asked to issue a full refund.`,
      })
    }

    return null
  },
})

// Completes a cash or bank refund after an authorized admin pays it manually
export const completeManualRefund = mutation({
  args: {
    bookingId: v.id('bookings'),
    reference: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    const { user } = await requireHotelManagement(ctx, booking.hotelId)
    if (booking.refundMethod !== 'manual') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Chapa refunds must be completed through the Chapa action.',
      })
    }

    if (booking.refundStatus === 'refunded') {
      return null
    }

    if (!['required', 'reversed'].includes(booking.refundStatus ?? '')) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'This manual refund is not ready to be completed.',
      })
    }

    const reference = args.reference?.trim() || undefined
    // Close the manual task and attribute the payout to the authenticated admin
    await transitionRefund(ctx, {
      booking,
      to: 'refunded',
      actor: { kind: 'user', userId: user._id },
      manualReference: reference,
      metadata: { reference },
    })

    if (booking.userId) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: booking.userId,
        type: 'booking_refunded',
        bookingId: booking._id,
        hotelId: booking.hotelId,
        message: `The full refund for booking #${booking._id.slice(-6).toUpperCase()} has been processed. Please allow 2–3 business days for the funds to reflect in your account.`,
      })
    }

    return null
  },
})

// Synchronizes a verified Chapa refund outcome onto the booking lifecycle
export const applyChapaRefundOutcome = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    outcome: v.union(
      v.literal('processing'),
      v.literal('refunded'),
      v.literal('reversed'),
      v.literal('verification_required'),
      v.literal('required'),
    ),
    txRef: v.string(),
    refundReference: v.optional(v.string()),
    refundRefId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking || booking.refundStatus === args.outcome) {
      return null
    }

    // Apply the provider result with its identifiers in the audit metadata
    await transitionRefund(ctx, {
      booking,
      to: args.outcome,
      method: 'chapa',
      actor: { kind: 'provider', provider: 'chapa' },
      error: args.error,
      metadata: {
        txRef: args.txRef,
        refundReference: args.refundReference,
        refundRefId: args.refundRefId,
      },
    })

    const needsStaffAttention = [
      'reversed',
      'verification_required',
      'required',
    ].includes(args.outcome)

    if (needsStaffAttention) {
      await ctx.runMutation(internal.notifications.notifyHotelStaff, {
        hotelId: booking.hotelId,
        type:
          args.outcome === 'required'
            ? 'booking_refund_required'
            : 'booking_refund_reversed',
        bookingId: booking._id,
        message:
          args.outcome === 'verification_required'
            ? `Refund response for booking #${booking._id.slice(-6).toUpperCase()} is uncertain. Check Chapa before taking any further action.`
            : `Refund for booking #${booking._id.slice(-6).toUpperCase()} needs administrator attention.`,
      })
    }

    if (booking.userId) {
      // The guest only hears settled outcomes, so an in-flight refund and an
      // internally reopened task both stay silent
      const type =
        args.outcome === 'refunded'
          ? ('booking_refunded' as const)
          : args.outcome === 'reversed'
            ? ('booking_refund_reversed' as const)
            : null

      if (type) {
        await ctx.runMutation(internal.notifications.createNotification, {
          userId: booking.userId,
          type,
          bookingId: booking._id,
          hotelId: booking.hotelId,
          message:
            args.outcome === 'refunded'
              ? `The full refund for booking #${booking._id.slice(-6).toUpperCase()} has been processed. Please allow 2–3 business days for the funds to reflect in your account.`
              : `The refund for booking #${booking._id.slice(-6).toUpperCase()} did not complete. The hotel has been alerted.`,
        })
      }
    }

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
        basePrice: v.number(),
        maxOccupancy: v.number(),
        operationalStatus: v.union(
          v.literal('available'),
          v.literal('maintenance'),
          v.literal('cleaning'),
          v.literal('out_of_order'),
        ),
        amenities: v.optional(v.array(v.string())),
        description: v.optional(v.string()),
        bedOptions: v.optional(v.string()),
        smokingAllowed: v.optional(v.boolean()),
      }),
      hotel: v.object({
        _id: v.id('hotels'),
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
        description: v.optional(v.string()),
        category: v.optional(hotelCategoryValidator),
        tags: v.optional(v.array(v.string())),
        parkingIncluded: v.optional(v.boolean()),
        rating: v.optional(v.number()),
        ratingSum: v.optional(v.number()),
        ratingCount: v.optional(v.number()),
      }),
      payment: v.union(customerPaymentSummaryValidator, v.null()),
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

    const [room, hotel, guestProfile, linkedUser, payment] = await Promise.all([
      ctx.db.get(booking.roomId),
      ctx.db.get(booking.hotelId),
      booking.guestProfileId ? ctx.db.get(booking.guestProfileId) : null,
      booking.userId ? ctx.db.get(booking.userId) : null,
      ctx.db
        .query('chapaPayments')
        .withIndex('by_booking', (q) => q.eq('bookingId', booking._id))
        .order('desc')
        .first(),
    ])

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
        basePrice: room.basePrice,
        maxOccupancy: room.maxOccupancy,
        operationalStatus: room.operationalStatus,
        amenities: room.amenities,
        description: room.description,
        bedOptions: room.bedOptions,
        smokingAllowed: room.smokingAllowed,
      },
      hotel: {
        _id: hotel._id,
        name: hotel.name,
        address: hotel.address,
        city: hotel.city,
        country: hotel.country,
        location: hotel.location,
        description: hotel.description,
        category: hotel.category,
        tags: hotel.tags,
        parkingIncluded: hotel.parkingIncluded,
        rating: hotel.rating,
        ratingSum: hotel.ratingSum,
        ratingCount: hotel.ratingCount,
      },
      payment: payment
        ? {
            _id: payment._id,
            txRef: payment.txRef,
            bookingAmountCents: payment.bookingAmountCents,
            bookingCurrency: payment.bookingCurrency,
            chargedAmountMinor: payment.chargedAmountMinor,
            chargedCurrency: payment.chargedCurrency,
            fxRateEtbPerUsd: payment.fxRateEtbPerUsd,
            status: payment.status,
            checkoutUrl: payment.checkoutUrl,
            paymentMethod: payment.paymentMethod,
            lastError: payment.lastError,
            verifiedAt: payment.verifiedAt,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
          }
        : null,
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
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(enrichedCustomerBookingValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    // Use compound index when status is provided to avoid in-memory filtering
    const paginatedBookings = args.status
      ? await ctx.db
          .query('bookings')
          .withIndex('by_user_and_status', (q) =>
            q.eq('userId', user._id).eq('status', args.status!),
          )
          .order('desc')
          .paginate(args.paginationOpts)
      : await ctx.db
          .query('bookings')
          .withIndex('by_user', (q) => q.eq('userId', user._id))
          .order('desc')
          .paginate(args.paginationOpts)

    const bookings = paginatedBookings.page

    // Enrich with room and hotel data
    const roomIds = uniqueIds(bookings.map((booking) => booking.roomId))
    const hotelIds = uniqueIds(bookings.map((booking) => booking.hotelId))

    const [rooms, hotels] = await Promise.all([
      Promise.all(roomIds.map((roomId) => ctx.db.get(roomId))),
      Promise.all(hotelIds.map((hotelId) => ctx.db.get(hotelId))),
    ])

    const roomMap = new Map(
      rooms.filter((room) => room !== null).map((room) => [room._id, room]),
    )
    const hotelMap = new Map(
      hotels
        .filter((hotel) => hotel !== null)
        .map((hotel) => [hotel._id, hotel]),
    )

    const page = bookings.flatMap((booking) => {
      const room = roomMap.get(booking.roomId)
      const hotel = hotelMap.get(booking.hotelId)

      if (!room || !hotel) {
        return []
      }

      return [
        {
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
        },
      ]
    })

    return {
      ...paginatedBookings,
      page,
    }
  },
})
