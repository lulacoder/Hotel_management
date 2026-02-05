import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Id } from '../../../../convex/_generated/dataModel'
import {
  Calendar,
  Hotel,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  LogIn,
  LogOut,
  Ban,
} from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/admin/bookings/')({
  component: BookingsPage,
})

function BookingsPage() {
  const { user } = useUser()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedHotel, setSelectedHotel] = useState<string>('all')

  const hotels = useQuery(api.hotels.list, {})

  // Get bookings for selected hotel or all
  const bookings = useQuery(
    api.bookings.getByHotel,
    user?.id && selectedHotel !== 'all'
      ? { clerkUserId: user.id, hotelId: selectedHotel as Id<'hotels'> }
      : 'skip',
  )

  const cancelBooking = useMutation(api.bookings.cancelBooking)

  const handleCancel = async (bookingId: Id<'bookings'>) => {
    if (!user?.id) return
    if (confirm('Are you sure you want to cancel this booking?')) {
      await cancelBooking({ clerkUserId: user.id, bookingId })
    }
  }

  const statusConfig = {
    held: {
      label: 'Held',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    confirmed: {
      label: 'Confirmed',
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    checked_in: {
      label: 'Checked In',
      icon: LogIn,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    checked_out: {
      label: 'Checked Out',
      icon: LogOut,
      color: 'text-slate-400',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/20',
    },
    cancelled: {
      label: 'Cancelled',
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
    expired: {
      label: 'Expired',
      icon: Ban,
      color: 'text-slate-500',
      bg: 'bg-slate-600/10',
      border: 'border-slate-600/20',
    },
  }

  const filteredBookings = bookings?.filter((booking) => {
    if (statusFilter !== 'all' && booking.status !== statusFilter) return false
    return true
  })

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mb-2">
          Bookings
        </h1>
        <p className="text-slate-400">
          View and manage all customer reservations.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Hotel Select */}
        <div className="flex-1">
          <select
            value={selectedHotel}
            onChange={(e) => setSelectedHotel(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800/50 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
          >
            <option value="all">Select a hotel...</option>
            {hotels?.map((hotel) => (
              <option key={hotel._id} value={hotel._id}>
                {hotel.name} - {hotel.city}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-48 px-4 py-3 bg-slate-900/50 border border-slate-800/50 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="held">Held</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="checked_out">Checked Out</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {selectedHotel === 'all' ? (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Hotel className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            Select a Hotel
          </h3>
          <p className="text-slate-500">
            Choose a hotel from the dropdown above to view its bookings.
          </p>
        </div>
      ) : bookings === undefined ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/20 border-t-amber-500"></div>
        </div>
      ) : filteredBookings?.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            No bookings found
          </h3>
          <p className="text-slate-500">
            {statusFilter !== 'all'
              ? 'Try changing the status filter.'
              : 'This hotel has no bookings yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings?.map((booking) => {
            const status =
              statusConfig[booking.status as keyof typeof statusConfig]
            const StatusIcon = status?.icon || AlertCircle

            return (
              <div
                key={booking._id}
                className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${status?.bg} ${status?.color} ${status?.border} border`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status?.label}
                      </div>
                      {booking.status === 'held' && booking.holdExpiresAt && (
                        <span className="text-xs text-slate-500">
                          Expires:{' '}
                          {new Date(booking.holdExpiresAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 mb-1">Dates</p>
                        <p className="text-slate-200">
                          {booking.checkIn} → {booking.checkOut}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">Guest</p>
                        <p className="text-slate-200">
                          {booking.guestName || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">Total</p>
                        <p className="text-slate-200 font-medium">
                          ${(booking.totalPrice / 100).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">Payment</p>
                        <p className="text-slate-200 capitalize">
                          {booking.paymentStatus || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {['held', 'confirmed'].includes(booking.status) && (
                    <button
                      onClick={() => handleCancel(booking._id)}
                      className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium border border-red-500/20"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
