import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Runs every 15 minutes to scan for held bookings whose holdExpiresAt timestamp
// has passed and transitions them to 'expired' status. This keeps the booking
// state consistent so rooms are released for new customers promptly.
crons.interval(
  'cleanup expired holds',
  { minutes: 15 },
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

// Runs once per day to delete notifications older than 10 days, keeping the
// notifications table lean and preventing stale alerts from accumulating.
crons.interval(
  'cleanup old notifications',
  { hours: 24 },
  internal.notificationsInternal.cleanupOldNotifications,
  {},
)

export default crons
