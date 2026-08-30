import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { transitionBooking } from './lib/bookingTransitions'
import { getAddisDate } from './lib/refundDeadline'

// Expires unpaid held or pending bookings and writes system audit events
export const cleanupExpiredHolds = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now()

    const timedOutHolds = await ctx.db
      .query('bookings')
      // The lower bound skips bookings with no timestamp, which the index
      // sorts below every number and which no lifecycle event may expire
      .withIndex('by_hold_expires', (q) =>
        q.gt('holdExpiresAt', 0).lt('holdExpiresAt', now),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'held'),
          q.neq(q.field('paymentStatus'), 'paid'),
          q.neq(q.field('paymentStatus'), 'refunded'),
        ),
      )
      .collect()

    // Bank transfer proofs drop their hold when they enter review, so the room
    // they still block is only reclaimable through the review deadline
    const unreviewedProofs = await ctx.db
      .query('bookings')
      .withIndex('by_proof_review_deadline', (q) =>
        q.gt('proofReviewDeadline', 0).lt('proofReviewDeadline', now),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'pending_payment'),
          q.neq(q.field('paymentStatus'), 'paid'),
          q.neq(q.field('paymentStatus'), 'refunded'),
        ),
      )
      .collect()

    const expiredCandidates = [...timedOutHolds, ...unreviewedProofs]

    // Expire each unpaid candidate concurrently without bypassing lifecycle rules
    await Promise.all(
      expiredCandidates.map(async (booking) => {
        // Mark the timed-out booking failed and record a system audit event
        await transitionBooking(ctx, {
          booking,
          event: 'hold_expired',
          to: 'expired',
          actor: {
            kind: 'system',
            reason:
              booking.status === 'pending_payment'
                ? 'payment_review_timeout'
                : 'hold_timeout',
          },
          changes:
            booking.status === 'pending_payment'
              ? { paymentStatus: 'failed', proofReviewDeadline: undefined }
              : { paymentStatus: 'failed' },
          now,
        })
      }),
    )

    const expiredCount = expiredCandidates.length

    if (expiredCount > 0) {
      console.log(
        `Expired ${timedOutHolds.length} holds and ${unreviewedProofs.length} unreviewed payment proofs`,
      )
    }

    return expiredCount
  },
})

// Creates refund tasks for paid guests still absent at 11:59 PM Addis time
export const createPaidNoShowRefundTasks = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now()
    const today = getAddisDate(now)
    const candidates = await ctx.db
      .query('bookings')
      .withIndex('by_status_payment_and_check_in', (q) =>
        q
          .eq('status', 'confirmed')
          .eq('paymentStatus', 'paid')
          .lte('checkIn', today),
      )
      .filter((q) => q.neq(q.field('refundActionRequired'), true))
      .collect()

    // Convert every still-confirmed paid arrival into one visible refund task
    for (const booking of candidates) {
      const chapaPayment = await ctx.db
        .query('chapaPayments')
        .withIndex('by_booking', (q) => q.eq('bookingId', booking._id))
        .order('desc')
        .filter((q) => q.eq(q.field('status'), 'paid'))
        .first()
      const refundMethod = chapaPayment
        ? ('chapa' as const)
        : ('manual' as const)

      await transitionBooking(ctx, {
        booking,
        event: 'paid_booking_cancelled',
        to: 'cancelled',
        actor: { kind: 'system', reason: 'paid_no_show_deadline' },
        changes: {
          refundStatus: 'required',
          refundMethod,
          refundReason: 'no_show',
          refundActionRequired: true,
          refundRequiredAt: now,
        },
        metadata: { deadlineDate: today },
        now,
      })

      if (chapaPayment) {
        // Queue the provider payment without sending money automatically
        await ctx.db.patch(chapaPayment._id, {
          status: 'refund_required',
          lastError: 'Paid guest did not check in by the hotel deadline.',
          updatedAt: now,
        })
      }

      await ctx.runMutation(internal.notifications.notifyHotelStaff, {
        hotelId: booking.hotelId,
        type: 'booking_refund_required',
        bookingId: booking._id,
        message: `Paid guest for booking #${booking._id.slice(-6).toUpperCase()} did not check in by 11:59 PM. A full ${refundMethod === 'chapa' ? 'Chapa' : 'manual'} refund requires review.`,
      })

      if (booking.userId) {
        await ctx.runMutation(internal.notifications.createNotification, {
          userId: booking.userId,
          type: 'booking_refund_required',
          bookingId: booking._id,
          hotelId: booking.hotelId,
          message: `Booking #${booking._id.slice(-6).toUpperCase()} was closed after the check-in deadline. The hotel has been asked to issue a full refund.`,
        })
      }
    }

    return candidates.length
  },
})
