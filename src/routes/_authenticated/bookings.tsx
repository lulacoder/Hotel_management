import { createFileRoute, Link } from '@tanstack/react-router'
import { useUser, UserButton } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import {
  Calendar,
  ArrowLeft,
  Clock,
  MapPin,
  BedDouble,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/bookings')({
  component: BookingsPage,
})

function BookingsPage() {
  const { user } = useUser()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const bookings = useQuery(
    api.bookings.getMyBookingsEnriched,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  const cancelBooking = useMutation(api.bookings.cancelBooking)

  const handleCancel = async (bookingId: string) => {
    if (!user?.id) return

    const confirmed = window.confirm(
      'Are you sure you want to cancel this booking?',
    )
    if (!confirmed) return

    setCancellingId(bookingId)
    try {
      await cancelBooking({
        clerkUserId: user.id,
        bookingId: bookingId as any,
      })
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      alert('Failed to cancel booking. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const getStatusBadge = (status: string) => {
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

  const getRoomTypeName = (type: string) => {
    switch (type) {
      case 'single':
        return 'Single Room'
      case 'double':
        return 'Double Room'
      case 'suite':
        return 'Suite'
      case 'deluxe':
        return 'Deluxe Room'
      default:
        return type
    }
  }

  const canCancel = (status: string) => {
    return ['held', 'confirmed'].includes(status)
  }

  const filteredBookings = bookings?.filter((b) => {
    if (statusFilter === 'all') return true
    return b.booking.status === statusFilter
  })

  const isLoading = bookings === undefined

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              to="/select-location"
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-white">My Bookings</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {user?.firstName || user?.emailAddresses[0]?.emailAddress}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Filter */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {[
            { value: 'all', label: 'All' },
            { value: 'held', label: 'Held' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'checked_in', label: 'Checked In' },
            { value: 'checked_out', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === filter.value
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredBookings?.length === 0 && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800/50 p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              {statusFilter === 'all'
                ? 'No Bookings Yet'
                : `No ${statusFilter.replace('_', ' ')} bookings`}
            </h2>
            <p className="text-slate-400 mb-6">
              {statusFilter === 'all'
                ? "You haven't made any bookings. Start by selecting a location!"
                : 'Try changing the filter to see other bookings.'}
            </p>
            <Link
              to="/select-location"
              className="inline-flex items-center px-6 py-3 bg-amber-500 text-slate-900 font-semibold rounded-xl hover:bg-amber-400 transition-colors"
            >
              Browse Hotels
            </Link>
          </div>
        )}

        {/* Bookings List */}
        {!isLoading && filteredBookings && filteredBookings.length > 0 && (
          <div className="space-y-4">
            {filteredBookings.map(({ booking, room, hotel }) => (
              <div
                key={booking._id}
                className="bg-slate-900 rounded-2xl border border-slate-800/50 p-6 hover:border-slate-700 transition-colors"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white text-lg">
                          {hotel.name}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-slate-400 mt-1">
                          <MapPin className="w-4 h-4" />
                          {hotel.address}, {hotel.city}
                        </div>
                      </div>
                      {getStatusBadge(booking.status)}
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
                        <span className="text-slate-500 block">
                          Price/Night
                        </span>
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
                            {new Date(booking.holdExpiresAt).toLocaleTimeString(
                              'en-US',
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                            . Please confirm your booking to secure it.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
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
                      onClick={() => handleCancel(booking._id)}
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
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
