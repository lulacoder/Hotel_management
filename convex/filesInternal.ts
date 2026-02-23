import { v } from 'convex/values'

import { internalMutation } from './_generated/server'

export const cleanupOrphanUploads = internalMutation({
  args: {
    olderThanMs: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const gracePeriodMs = args.olderThanMs ?? 2 * 60 * 60 * 1000
    const cutoff = now - gracePeriodMs

    const candidates = await ctx.db
      .query('fileUploads')
      .withIndex('by_status_and_uploaded_at', (q) =>
        q.eq('status', 'pending').lt('uploadedAt', cutoff),
      )
      .collect()

    const activeHotels = await ctx.db
      .query('hotels')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
    const allRooms = await ctx.db.query('rooms').collect()

    let deletedCount = 0

    for (const upload of candidates) {
      const linkedHotel = activeHotels.find(
        (hotel) => hotel.imageStorageId === upload.storageId,
      )
      const linkedRoom = allRooms.find(
        (room) => !room.isDeleted && room.imageStorageId === upload.storageId,
      )

      if (linkedHotel || linkedRoom) {
        await ctx.db.patch(upload._id, {
          status: 'assigned',
          assignedAt: now,
        })
        continue
      }

      await ctx.storage.delete(upload.storageId)
      await ctx.db.patch(upload._id, {
        status: 'deleted',
        deletedAt: now,
      })
      deletedCount++
    }

    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} orphan uploads`)
    }

    return deletedCount
  },
})
