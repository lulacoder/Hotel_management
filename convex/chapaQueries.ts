import { ConvexError, v } from 'convex/values'

import { query } from './_generated/server'
import { chapaPaymentValidator } from './chapaInternal'
import { requireHotelAccess, requireUser } from './lib/auth'

export const getPaymentForBooking = query({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.union(chapaPaymentValidator, v.null()),
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      return null
    }

    await requireHotelAccess(ctx, booking.hotelId)

    return await ctx.db
      .query('chapaPayments')
      .withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId))
      .order('desc')
      .first()
  },
})

export const getCheckoutStatus = query({
  args: {
    txRef: v.string(),
  },
  returns: v.union(
    v.object({
      txRef: v.string(),
      status: v.union(
        v.literal('initialized'),
        v.literal('paid'),
        v.literal('failed'),
        v.literal('cancelled'),
        v.literal('refund_required'),
        v.literal('refund_initiated'),
        v.literal('refunded'),
        v.literal('reversed'),
      ),
      bookingId: v.id('bookings'),
      bookingStatus: v.string(),
      paymentStatus: v.optional(v.string()),
      checkoutUrl: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const payment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()

    if (!payment) {
      return null
    }

    const booking = await ctx.db.get(payment.bookingId)
    if (!booking) {
      return null
    }

    if (booking.userId !== user._id) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this payment.',
      })
    }

    return {
      txRef: payment.txRef,
      status: payment.status,
      bookingId: payment.bookingId,
      bookingStatus: booking.status,
      paymentStatus: booking.paymentStatus,
      checkoutUrl: payment.checkoutUrl,
    }
  },
})
