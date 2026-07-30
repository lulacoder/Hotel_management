import { v } from 'convex/values'

import { internalMutation } from './_generated/server'
import { r2 } from './r2'

// Internal mutation to clean up orphaned file uploads that were never assigned to a resource.
// Finds all 'pending' fileUploads older than the specified grace period (default 2 hours).
// Before deleting the file from Convex storage, it performs a fallback check by scanning
// all active hotels, rooms, and bookings. If the file is actually in use, it corrects the status to 'assigned'.
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

    // The reference scan below reads the whole hotels/rooms/bookings tables,
    // so skip it entirely on the (common) runs with nothing to clean up.
    if (candidates.length === 0) {
      return 0
    }

    const activeHotels = await ctx.db
      .query('hotels')
      .withIndex('by_is_deleted', (q) => q.eq('isDeleted', false))
      .collect()
    const allRooms = await ctx.db.query('rooms').collect()
    const allBookings = await ctx.db.query('bookings').collect()

    const cleanupResults = await Promise.all(
      candidates.map(async (upload) => {
        const linkedHotel = activeHotels.find(
          (hotel) =>
            (upload.storageId !== undefined &&
              hotel.imageStorageId === upload.storageId) ||
            (upload.r2Key !== undefined && hotel.imageR2Key === upload.r2Key),
        )
        const linkedRoom = allRooms.find(
          (room) =>
            !room.isDeleted &&
            ((upload.storageId !== undefined &&
              room.imageStorageId === upload.storageId) ||
              (upload.r2Key !== undefined &&
                room.imageR2Key === upload.r2Key)),
        )
        const linkedBooking = allBookings.find(
          (booking) =>
            (upload.storageId !== undefined &&
              booking.nationalIdStorageId === upload.storageId) ||
            (upload.r2Key !== undefined &&
              booking.nationalIdR2Key === upload.r2Key),
        )

        if (linkedHotel || linkedRoom || linkedBooking) {
          await ctx.db.patch(upload._id, {
            status: 'assigned',
            resourceType: linkedHotel
              ? 'hotel'
              : linkedRoom
                ? 'room'
                : 'booking',
            resourceId: (linkedHotel ?? linkedRoom ?? linkedBooking)?._id,
            assignedAt: now,
          })
          return 0
        }

        if (upload.storageId) {
          await ctx.storage.delete(upload.storageId)
        }
        if (upload.r2Key) {
          await r2.deleteObject(ctx, upload.r2Key)
        }
        await ctx.db.patch(upload._id, {
          status: 'deleted',
          deletedAt: now,
        })
        return 1
      }),
    )

    const deletedCount = cleanupResults.reduce<number>(
      (sum, count) => sum + count,
      0,
    )

    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} orphan uploads`)
    }

    return deletedCount
  },
})
