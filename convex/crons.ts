import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Run every 5 minutes to clean up expired holds
crons.interval(
  'cleanup expired holds',
  { minutes: 5 },
  internal.bookingsInternal.cleanupExpiredHolds,
)

export default crons
