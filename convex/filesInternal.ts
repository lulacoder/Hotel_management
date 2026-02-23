import { v } from 'convex/values'

import { internalMutation } from './_generated/server'

// Internal mutation to clean up orphaned file uploads that were never assigned to a resource.
// Finds all 'pending' fileUploads older than the specified grace period (default 2 hours).
// Before deleting the file from Convex storage, it performs a fallback check by scanning
// all active hotels and rooms. If the file is actually in use, it corrects the status to 'assigned'.
// Otherwise, the file is deleted from storage and the record is marked as 'deleted'.
// Returns the count of deleted files.
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
