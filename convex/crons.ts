import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Runs every 5 minutes to scan for held bookings whose holdExpiresAt timestamp
// has passed and transitions them to 'expired' status. This keeps the booking
// state consistent so rooms are released for new customers promptly.
crons.interval(
  'cleanup expired holds',
  { minutes: 5 },
  internal.bookingsInternal.cleanupExpiredHolds,
)

// Runs every 2 hours to remove file uploads that were never linked to a hotel
// or room (i.e., still in 'pending' status after the grace period). This
// prevents orphaned files from accumulating in Convex storage.
crons.interval(
  'cleanup orphan uploads',
  { hours: 2 },
  internal.filesInternal.cleanupOrphanUploads,
  {},
)

export default crons
