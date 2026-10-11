// List wrapper that renders empty/loading states and booking cards.
import { BookingCard } from './-BookingCard'

import type { Id } from '../../../../../convex/_generated/dataModel'
import type { CustomerBooking } from './-BookingCard'

interface BookingsListProps {
  bookings: Array<CustomerBooking>
  cancellingId: string | null
  onCancel: (bookingId: Id<'bookings'>) => void
}

export function BookingsList({
  bookings,
  cancellingId,
  onCancel,
}: BookingsListProps) {
  // Render pre-filtered booking entries; item-level actions live in BookingCard.
  return (
    <div className="space-y-4">
      {bookings.map(({ booking, room, hotel }) => (
        <BookingCard
          key={booking._id}
          booking={booking}
          room={room}
          hotel={hotel}
          cancellingId={cancellingId}
          onCancel={onCancel}
        />
      ))}
    </div>
  )
}
