import { v } from 'convex/values'

import { internalMutation } from './_generated/server'

// Internal mutation to clean up expired holds and pending payments.
// Scans bookings with 'held' or 'pending_payment' status and checks whether
// holdExpiresAt has passed. For each expired booking, it sets status to
// 'expired', marks paymentStatus as 'failed', and inserts an audit event.
// Returns the total count of bookings expired in this run.
export const cleanupExpiredHolds = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now()

    const heldBookings = await ctx.db
      .query('bookings')
      .withIndex('by_status', (q) => q.eq('status', 'held'))
      .collect()

    const pendingPaymentBookings = await ctx.db
      .query('bookings')
      .withIndex('by_status', (q) => q.eq('status', 'pending_payment'))
      .collect()

    // Combine held and pending payment bookings to check for expirations in one pass.
    const candidates = [...heldBookings, ...pendingPaymentBookings]

    let expiredCount = 0

    // Process each candidate booking to determine if it has expired.
    for (const booking of candidates) {
      if (booking.holdExpiresAt && booking.holdExpiresAt < now) {
        await ctx.db.patch(booking._id, {
          status: 'expired',
          paymentStatus: 'failed',
          updatedAt: now,
        })

        if (booking.userId) {
          await ctx.db.insert('auditEvents', {
            actorId: booking.userId,
            action: 'booking_expired',
            targetType: 'booking',
            targetId: booking._id,
            previousValue: JSON.stringify({ status: booking.status }),
            newValue: JSON.stringify({ status: 'expired', paymentStatus: 'failed' }),
            metadata: { system: true, reason: 'hold_timeout' },
            timestamp: now,
          })
        }

        expiredCount++
      }
    }

    if (expiredCount > 0) {
      console.log(`Expired ${expiredCount} held/pending-payment bookings`)
    }

    return expiredCount
  },
})
