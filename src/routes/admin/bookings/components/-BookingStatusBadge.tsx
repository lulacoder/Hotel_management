import type { BookingStatus } from '../../../../../convex/lib/bookingLifecycle'
import type { BookingStatusDisplay } from '@/lib/bookingStatus'

interface BookingStatusBadgeProps {
  status: BookingStatus
  statusConfig: Record<BookingStatus, BookingStatusDisplay>
}

export function BookingStatusBadge({
  status,
  statusConfig,
}: BookingStatusBadgeProps) {
  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-sm font-medium ${config.bg} ${config.color} ${config.border}`}
    >
      <StatusIcon className="size-3.5" />
      {config.label}
    </div>
  )
}
