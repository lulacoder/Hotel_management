import { Link, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  CheckCircle,
  CircleDollarSign,
  Clock,
  LogIn,
  LogOut,
  XCircle,
} from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import {
  formatPackageAddOn,
  getPackageLabelOrDefault,
} from '../../../lib/packages'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/admin/bookings/$bookingId')({
  component: BookingDetailPage,
})

function BookingDetailPage() {
  const { bookingId } = Route.useParams()
  const typedBookingId = bookingId as Id<'bookings'>
  const { user } = useUser()

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

  const bookingDetail = useQuery(
    api.bookings.getEnriched,
    user?.id ? { clerkUserId: user.id, bookingId: typedBookingId } : 'skip',
  )

  const updateBookingStatus = useMutation(api.bookings.updateStatus)
  const acceptCashPayment = useMutation(api.bookings.acceptCashPayment)

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
      icon: XCircle,
      color: 'text-slate-500',
      bg: 'bg-slate-600/10',
      border: 'border-slate-600/20',
    },
  }

  const canManageBookings =
    profile?.role === 'room_admin' ||
    (hotelAssignment &&
      bookingDetail &&
      hotelAssignment.hotelId === bookingDetail.hotel._id &&
      ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role))

  const handleStatusChange = async (
    nextStatus: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled',
  ) => {
    if (!user?.id) return
    await updateBookingStatus({
      clerkUserId: user.id,
      bookingId: typedBookingId,
      nextStatus,
    })
  }

  const handleAcceptCashPayment = async () => {
    if (!user?.id) return
    await acceptCashPayment({ clerkUserId: user.id, bookingId: typedBookingId })
  }

  if (bookingDetail === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/20 border-t-amber-500"></div>
      </div>
    )
  }

  if (bookingDetail === null) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Booking not found</h3>
          <Link
            to="/admin/bookings"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Bookings
          </Link>
        </div>
      </div>
    )
  }

  const status = statusConfig[bookingDetail.booking.status]
  const StatusIcon = status.icon

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/admin/bookings"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Bookings
      </Link>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-semibold text-slate-100">Booking Detail</h1>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${status.bg} ${status.color} ${status.border} border`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            {status.label}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">Guest</p>
            <p className="text-slate-100 font-medium">{bookingDetail.booking.guestName || 'N/A'}</p>
            <p className="text-slate-400">{bookingDetail.booking.guestEmail || 'N/A'}</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">Room</p>
            <p className="text-slate-100 font-medium">Room {bookingDetail.room.roomNumber}</p>
            <p className="text-slate-400 capitalize">{bookingDetail.room.type}</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">Hotel</p>
            <p className="text-slate-100 font-medium">{bookingDetail.hotel.name}</p>
            <p className="text-slate-400">{bookingDetail.hotel.address}, {bookingDetail.hotel.city}</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">Stay</p>
            <p className="text-slate-100 font-medium">
              {bookingDetail.booking.checkIn} → {bookingDetail.booking.checkOut}
            </p>
            <p className="text-slate-400">${(bookingDetail.booking.totalPrice / 100).toFixed(2)}</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">Payment</p>
            <p className="text-slate-100 font-medium capitalize">
              {bookingDetail.booking.paymentStatus || 'pending'}
            </p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">Package</p>
            <p className="text-slate-100 font-medium">
              {getPackageLabelOrDefault(bookingDetail.booking.packageType)}
            </p>
            {bookingDetail.booking.packageType && (
              <p className="text-slate-400">
                {formatPackageAddOn(bookingDetail.booking.packageAddOn ?? 0)}
              </p>
            )}
          </div>
          {bookingDetail.booking.specialRequests && (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-500 mb-1">Special Requests</p>
              <p className="text-slate-300">{bookingDetail.booking.specialRequests}</p>
            </div>
          )}
        </div>
      </div>

      {canManageBookings && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {bookingDetail.booking.paymentStatus !== 'paid' &&
              !['cancelled', 'expired'].includes(bookingDetail.booking.status) && (
                <button
                  onClick={handleAcceptCashPayment}
                  className="px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors text-sm font-medium border border-emerald-500/20 inline-flex items-center gap-2"
                >
                  <CircleDollarSign className="w-4 h-4" />
                  Accept Cash Payment
                </button>
              )}

            {getAllowedTransitions(bookingDetail.booking.status).map((nextStatus) => (
              <button
                key={nextStatus}
                onClick={() => handleStatusChange(nextStatus)}
                className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium border ${
                  nextStatus === 'cancelled'
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20'
                    : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20'
                }`}
              >
                {transitionLabel[nextStatus]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
