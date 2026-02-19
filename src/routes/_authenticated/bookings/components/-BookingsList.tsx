import { BookingCard } from './-BookingCard'

import type { Id } from '../../../../../convex/_generated/dataModel'
import type { PackageType } from '../../../../lib/packages'

interface BookingsListProps {
  bookings: Array<{
    booking: {
      _id: Id<'bookings'>
      checkIn: string
      checkOut: string
      pricePerNight: number
      totalPrice: number
      status: string
      holdExpiresAt?: number | undefined
      packageType?: PackageType | undefined
      packageAddOn?: number | undefined
    }
    room: {
      roomNumber: string
      type: string
    }
    hotel: {
      _id: Id<'hotels'>
      name: string
      address: string
      city: string
    }
  }>
  cancellingId: string | null
  onCancel: (bookingId: Id<'bookings'>) => void
}

export function BookingsList({
  bookings,
  cancellingId,
  onCancel,
}: BookingsListProps) {
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
