import { internalMutation } from './_generated/server'
import { v } from 'convex/values'

// Deletes all notifications older than 10 days.
// Called daily by the cron job in crons.ts.
export const cleanupOldNotifications = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000
    const cutoff = Date.now() - TEN_DAYS_MS

    const old = await ctx.db
      .query('notifications')
      .withIndex('by_created_at', (q) => q.lt('createdAt', cutoff))
      .collect()

    await Promise.all(old.map((n) => ctx.db.delete(n._id)))

    return old.length
  },
})
