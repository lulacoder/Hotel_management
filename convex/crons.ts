import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Runs every 15 minutes to scan for bookings that have run out of time, either
// a held booking past its checkout hold or a pending-payment booking past its
// staff review deadline, and transitions them to 'expired' status. This keeps
// the booking state consistent so rooms are released for new customers promptly.
crons.interval(
  'cleanup expired holds',
  { minutes: 15 },
  internal.bookingsInternal.cleanupExpiredHolds,
)

// At 11:59 PM Addis time, queue paid no-shows for staff refund review
crons.daily(
  'create paid no-show refund tasks',
  { hourUTC: 20, minuteUTC: 59 },
  internal.bookingsInternal.createPaidNoShowRefundTasks,
)

// Reconcile accepted refunds when Chapa's webhook is delayed or missed
crons.interval(
  'verify pending Chapa refunds',
  { minutes: 15 },
  internal.chapaActions.verifyPendingRefunds,
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
