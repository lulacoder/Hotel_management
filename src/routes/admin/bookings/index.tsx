import { Link, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import {
  Ban,
  Calendar,
  CheckCircle,
  CircleDollarSign,
  Clock,
  Eye,
  Hotel,
  LogIn,
  LogOut,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/admin/bookings/')({
  component: BookingsPage,
})

function BookingsPage() {
  const { user } = useUser()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedHotel, setSelectedHotel] = useState<string>('all')
  const [selectedBookingId, setSelectedBookingId] = useState<Id<'bookings'> | null>(
    null,
  )

  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )
  const hotelAssignment = useQuery(
    api.hotelStaff.getByUserId,
    user?.id && profile?._id
      ? { clerkUserId: user.id, userId: profile._id }
      : 'skip',
  )

  const hotels = useQuery(api.hotels.list, {})
  const visibleHotels =
    profile?.role === 'room_admin'
      ? hotels
      : hotels?.filter((hotel) => hotel._id === hotelAssignment?.hotelId)

  useEffect(() => {
    if (profile?.role !== 'room_admin' && hotelAssignment?.hotelId) {
      setSelectedHotel(hotelAssignment.hotelId)
    }
  }, [profile?.role, hotelAssignment?.hotelId])

  // Get bookings for selected hotel or all
  const bookings = useQuery(
    api.bookings.getByHotel,
    user?.id && selectedHotel !== 'all'
      ? { clerkUserId: user.id, hotelId: selectedHotel as Id<'hotels'> }
      : 'skip',
  )

  const cancelBooking = useMutation(api.bookings.cancelBooking)
  const updateBookingStatus = useMutation(api.bookings.updateStatus)
  const acceptCashPayment = useMutation(api.bookings.acceptCashPayment)
  const selectedBookingDetail = useQuery(
    api.bookings.getEnriched,
    user?.id && selectedBookingId
      ? { clerkUserId: user.id, bookingId: selectedBookingId }
      : 'skip',
  )

  const handleCancel = async (bookingId: Id<'bookings'>) => {
    if (!user?.id) return
    if (confirm('Are you sure you want to cancel this booking?')) {
      await cancelBooking({ clerkUserId: user.id, bookingId })
    }
  }

  const handleStatusChange = async (
    bookingId: Id<'bookings'>,
    nextStatus: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled',
  ) => {
    if (!user?.id) return
    await updateBookingStatus({ clerkUserId: user.id, bookingId, nextStatus })
  }

  const handleAcceptCashPayment = async (bookingId: Id<'bookings'>) => {
    if (!user?.id) return
    await acceptCashPayment({ clerkUserId: user.id, bookingId })
  }

  const getAllowedTransitions = (status: string) => {
    if (status === 'held') return ['confirmed', 'cancelled'] as const
    if (status === 'confirmed') return ['checked_in', 'cancelled'] as const
    if (status === 'checked_in') return ['checked_out'] as const
    return [] as const
  }

  const transitionLabel: Record<'confirmed' | 'checked_in' | 'checked_out' | 'cancelled', string> = {
    confirmed: 'Confirm',
    checked_in: 'Check In',
    checked_out: 'Check Out',
    cancelled: 'Cancel',
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

  const canManageBookings =
    profile?.role === 'room_admin' ||
    (hotelAssignment?.hotelId === selectedHotel &&
      ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role))

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
            {profile?.role === 'room_admin' && (
              <option value="all">Select a hotel...</option>
            )}
            {visibleHotels?.map((hotel) => (
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
      {selectedHotel === 'all' && profile?.role === 'room_admin' ? (
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
            const status = statusConfig[booking.status]
            const StatusIcon = status.icon

            return (
              <div
                key={booking._id}
                className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${status.bg} ${status.color} ${status.border} border`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
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

                  <div className="flex flex-wrap gap-2 md:justify-end md:w-80">
                    <button
                      onClick={() => setSelectedBookingId(booking._id)}
                      className="px-3 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-700 inline-flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Detail
                    </button>

                    <Link
                      to="/admin/bookings/$bookingId"
                      params={{ bookingId: booking._id }}
                      className="px-3 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-700"
                    >
                      Open Page
                    </Link>

                    {canManageBookings &&
                      booking.paymentStatus !== 'paid' &&
                      !['cancelled', 'expired'].includes(booking.status) && (
                        <button
                          onClick={() => handleAcceptCashPayment(booking._id)}
                          className="px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors text-sm font-medium border border-emerald-500/20 inline-flex items-center gap-2"
                        >
                          <CircleDollarSign className="w-4 h-4" />
                          Accept Cash
                        </button>
                      )}

                    {canManageBookings &&
                      getAllowedTransitions(booking.status).map((nextStatus) =>
                        nextStatus === 'cancelled' ? (
                          <button
                            key={`${booking._id}-${nextStatus}`}
                            onClick={() => handleCancel(booking._id)}
                            className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium border border-red-500/20"
                          >
                            {transitionLabel[nextStatus]}
                          </button>
                        ) : (
                          <button
                            key={`${booking._id}-${nextStatus}`}
                            onClick={() => handleStatusChange(booking._id, nextStatus)}
                            className="px-3 py-2 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-medium border border-amber-500/20"
                          >
                            {transitionLabel[nextStatus]}
                          </button>
                        ),
                      )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/70"
            onClick={() => setSelectedBookingId(null)}
            aria-label="Close booking details"
          />
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-100">
                  Booking Details
                </h3>
                <p className="text-slate-400 text-sm">
                  Review booking, room assignment, and payment status.
                </p>
              </div>
              <button
                onClick={() => setSelectedBookingId(null)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedBookingDetail === undefined ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/20 border-t-amber-500"></div>
              </div>
            ) : selectedBookingDetail === null ? (
              <div className="text-slate-400">Booking not found.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-500 mb-1">Guest</p>
                    <p className="text-slate-100 font-medium">
                      {selectedBookingDetail.booking.guestName || 'N/A'}
                    </p>
                    <p className="text-slate-400">
                      {selectedBookingDetail.booking.guestEmail || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-500 mb-1">Room</p>
                    <p className="text-slate-100 font-medium">
                      Room {selectedBookingDetail.room.roomNumber}
                    </p>
                    <p className="text-slate-400 capitalize">
                      {selectedBookingDetail.room.type}
                    </p>
                  </div>
                  <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-500 mb-1">Hotel</p>
                    <p className="text-slate-100 font-medium">
                      {selectedBookingDetail.hotel.name}
                    </p>
                    <p className="text-slate-400">
                      {selectedBookingDetail.hotel.city}
                    </p>
                  </div>
                  <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-500 mb-1">Stay</p>
                    <p className="text-slate-100 font-medium">
                      {selectedBookingDetail.booking.checkIn} →{' '}
                      {selectedBookingDetail.booking.checkOut}
                    </p>
                    <p className="text-slate-400">
                      ${(selectedBookingDetail.booking.totalPrice / 100).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Link
                    to="/admin/bookings/$bookingId"
                    params={{ bookingId: selectedBookingId }}
                    className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-700"
                  >
                    Open Full Detail Page
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
