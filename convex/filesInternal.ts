import { v } from 'convex/values'

import { internalMutation } from './_generated/server'
import { r2 } from './r2'

// Internal mutation to clean up orphaned file uploads that were never assigned to a resource.
// Finds up to 200 'pending' fileUploads older than the specified grace period (default 2 hours).
// Before deleting the file from Convex storage, it checks indexed image references
// in hotels, rooms, and bookings. If the file is actually in use, it corrects the status to 'assigned'.
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

    // Bound cron work per run so cost follows candidate count, not table size
    const candidates = await ctx.db
      .query('fileUploads')
      .withIndex('by_status_and_uploaded_at', (q) =>
        q.eq('status', 'pending').lt('uploadedAt', cutoff),
      )
      .take(200)

    if (candidates.length === 0) {
      return 0
    }

    // A key should belong to at most one live document, but a soft-deleted row
    // can still hold it. Read a few matches so a live owner is never missed and
    // a file in use never gets deleted.
    const MATCHES_PER_KEY = 8

    // Helper checks one upload against indexed image references without full scans
    const findLink = async (upload: (typeof candidates)[number]) => {
      if (upload.storageId !== undefined) {
        const hotelHits = await ctx.db
          .query('hotels')
          .withIndex('by_image_storage', (q) =>
            q.eq('imageStorageId', upload.storageId),
          )
          .take(MATCHES_PER_KEY)
        const liveHotel = hotelHits.find((hotel) => !hotel.isDeleted)
        if (liveHotel) return { type: 'hotel' as const, id: liveHotel._id }
        const roomHits = await ctx.db
          .query('rooms')
          .withIndex('by_image_storage', (q) =>
            q.eq('imageStorageId', upload.storageId),
          )
          .take(MATCHES_PER_KEY)
        const liveRoom = roomHits.find((room) => !room.isDeleted)
        if (liveRoom) return { type: 'room' as const, id: liveRoom._id }
        const bookingHit = await ctx.db
          .query('bookings')
          .withIndex('by_national_id_storage', (q) =>
            q.eq('nationalIdStorageId', upload.storageId),
          )
          .first()
        if (bookingHit) return { type: 'booking' as const, id: bookingHit._id }
      }
      if (upload.r2Key !== undefined) {
        const hotelHits = await ctx.db
          .query('hotels')
          .withIndex('by_image_r2', (q) => q.eq('imageR2Key', upload.r2Key))
          .take(MATCHES_PER_KEY)
        const liveHotel = hotelHits.find((hotel) => !hotel.isDeleted)
        if (liveHotel) return { type: 'hotel' as const, id: liveHotel._id }
        const roomHits = await ctx.db
          .query('rooms')
          .withIndex('by_image_r2', (q) => q.eq('imageR2Key', upload.r2Key))
          .take(MATCHES_PER_KEY)
        const liveRoom = roomHits.find((room) => !room.isDeleted)
        if (liveRoom) return { type: 'room' as const, id: liveRoom._id }
        const bookingHit = await ctx.db
          .query('bookings')
          .withIndex('by_national_id_r2', (q) =>
            q.eq('nationalIdR2Key', upload.r2Key),
          )
          .first()
        if (bookingHit) return { type: 'booking' as const, id: bookingHit._id }
      }
      return null
    }

    const cleanupResults = await Promise.all(
      candidates.map(async (upload) => {
        const linked = await findLink(upload)
        const linkedHotel = linked?.type === 'hotel' ? linked : null
        const linkedRoom = linked?.type === 'room' ? linked : null
        const linkedBooking = linked?.type === 'booking' ? linked : null

        if (linkedHotel || linkedRoom || linkedBooking) {
          await ctx.db.patch(upload._id, {
            status: 'assigned',
            resourceType: linkedHotel
              ? 'hotel'
              : linkedRoom
                ? 'room'
                : 'booking',
            resourceId: (linkedHotel ?? linkedRoom ?? linkedBooking)?.id,
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
