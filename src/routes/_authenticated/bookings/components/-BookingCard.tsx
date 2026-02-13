import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  BedDouble,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  X,
  XCircle,
} from 'lucide-react'

import { Id } from '../../../../../convex/_generated/dataModel'
import { canCancel, formatDate, formatPrice, getRoomTypeName } from './-helpers'

interface BookingCardProps {
  booking: {
    _id: Id<'bookings'>
    checkIn: string
    checkOut: string
    pricePerNight: number
    totalPrice: number
    status: string
    holdExpiresAt?: number | undefined
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
  cancellingId: string | null
  onCancel: (bookingId: Id<'bookings'>) => void
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'held':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <Clock className="w-3 h-3" />
          Held
        </span>
      )
    case 'confirmed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
          <CheckCircle className="w-3 h-3" />
          Confirmed
        </span>
      )
    case 'checked_in':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <CheckCircle className="w-3 h-3" />
          Checked In
        </span>
      )
    case 'checked_out':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">
          <CheckCircle className="w-3 h-3" />
          Checked Out
        </span>
      )
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
          <XCircle className="w-3 h-3" />
          Cancelled
        </span>
      )
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">
          <AlertCircle className="w-3 h-3" />
          Expired
        </span>
      )
    default:
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400">
          {status}
        </span>
      )
  }
}

export function BookingCard({
  booking,
  room,
  hotel,
  cancellingId,
  onCancel,
}: BookingCardProps) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800/50 p-6 hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-white text-lg">{hotel.name}</h3>
              <div className="flex items-center gap-1 text-sm text-slate-400 mt-1">
                <MapPin className="w-4 h-4" />
                {hotel.address}, {hotel.city}
              </div>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          <div className="flex items-center gap-2 text-slate-300 mb-4">
            <BedDouble className="w-4 h-4 text-amber-400" />
            <span>
              {getRoomTypeName(room.type)} - Room {room.roomNumber}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block">Check-in</span>
              <span className="text-slate-200 font-medium">
                {formatDate(booking.checkIn)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Check-out</span>
              <span className="text-slate-200 font-medium">
                {formatDate(booking.checkOut)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Price/Night</span>
              <span className="text-slate-200 font-medium">
                {formatPrice(booking.pricePerNight)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Total</span>
              <span className="text-amber-400 font-semibold">
                {formatPrice(booking.totalPrice)}
              </span>
            </div>
          </div>

          {booking.status === 'held' && booking.holdExpiresAt && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>
                  Hold expires at{' '}
                  {new Date(booking.holdExpiresAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  . Please confirm your booking to secure it.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {canCancel(booking.status) && (
        <div className="mt-4 pt-4 border-t border-slate-800 flex gap-3">
          {booking.status === 'held' && (
            <Link
              to="/hotels/$hotelId"
              params={{ hotelId: hotel._id }}
              className="px-4 py-2 bg-amber-500 text-slate-900 font-medium rounded-lg hover:bg-amber-400 transition-colors text-sm"
            >
              Confirm Booking
            </Link>
          )}
          <button
            onClick={() => onCancel(booking._id)}
            disabled={cancellingId === booking._id}
            className="px-4 py-2 bg-slate-800 text-red-400 font-medium rounded-lg hover:bg-red-500/20 hover:text-red-300 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {cancellingId === booking._id ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                Cancel
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
