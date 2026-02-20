import { v } from 'convex/values'

import { internalMutation } from './_generated/server'

// Internal mutation to clean up expired holds
// Called by the cron job every 5 minutes
export const cleanupExpiredHolds = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now()

    // Find all held bookings that have expired
    const expiredHolds = await ctx.db
      .query('bookings')
      .withIndex('by_status', (q) => q.eq('status', 'held'))
      .collect()

    let expiredCount = 0

    for (const booking of expiredHolds) {
      if (booking.holdExpiresAt && booking.holdExpiresAt < now) {
        await ctx.db.patch(booking._id, {
          status: 'expired',
          updatedAt: now,
        })

        if (booking.userId) {
          await ctx.db.insert('auditEvents', {
            actorId: booking.userId,
            action: 'booking_expired',
            targetType: 'booking',
            targetId: booking._id,
            previousValue: JSON.stringify({ status: 'held' }),
            newValue: JSON.stringify({ status: 'expired' }),
            metadata: { system: true, reason: 'hold_timeout' },
            timestamp: now,
          })
        }

        expiredCount++
      }
    }

    if (expiredCount > 0) {
      console.log(`Expired ${expiredCount} held bookings`)
    }

    return expiredCount
  },
})
