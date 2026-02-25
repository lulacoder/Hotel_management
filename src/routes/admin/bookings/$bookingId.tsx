// Booking details route for a specific booking record in the admin area.
import { Link, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  CheckCircle,
  Copy,
  CircleDollarSign,
  Clock,
  Hotel,
  Image,
  LogIn,
  LogOut,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n'
import {
  formatPackageAddOn,
  getPackageLabelOrDefault,
} from '../../../lib/packages'
import { OutsourceModal } from './components/-OutsourceModal'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/admin/bookings/$bookingId')({
  // Register admin booking detail route for status/payment operations.
  component: BookingDetailPage,
})

function BookingDetailPage() {
  // Fetch booking graph + role context used for permissions and actions.
  const { bookingId } = Route.useParams()
  const typedBookingId = bookingId as Id<'bookings'>
  const { user } = useUser()
  const { t } = useI18n()
  const [showOutsourceModal, setShowOutsourceModal] = useState(false)

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
  const outsourcedToHotel = useQuery(
    api.hotels.get,
    bookingDetail?.booking.outsourcedToHotelId
      ? { hotelId: bookingDetail.booking.outsourcedToHotelId }
      : 'skip',
  )

  const updateBookingStatus = useMutation(api.bookings.updateStatus)
  const acceptCashPayment = useMutation(api.bookings.acceptCashPayment)
  const verifyPayment = useMutation(api.bookings.verifyPayment)
  const rejectPayment = useMutation(api.bookings.rejectPayment)

  const nationalIdImageUrl = useQuery(
    (api as any).files.getFileUrl,
    bookingDetail?.booking.nationalIdStorageId
      ? { storageId: bookingDetail.booking.nationalIdStorageId }
      : 'skip',
  )

  const getAllowedTransitions = (status: string) => {
    // Encode valid status transitions for action buttons.
    if (status === 'held') return ['cancelled'] as const
    if (status === 'confirmed') return ['checked_in', 'cancelled'] as const
    if (status === 'checked_in') return ['checked_out'] as const
    return [] as const
  }

  const transitionLabel: Record<
    'confirmed' | 'checked_in' | 'checked_out' | 'cancelled',
    string
  > = {
    confirmed: t('booking.transition.confirm'),
    checked_in: t('booking.transition.checkIn'),
    checked_out: t('booking.transition.checkOut'),
    cancelled: t('booking.transition.cancel'),
  }

  const statusConfig = {
    held: {
      label: t('booking.status.held'),
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    pending_payment: {
      label: t('booking.status.pendingPayment'),
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    confirmed: {
      label: t('booking.status.confirmed'),
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    checked_in: {
      label: t('booking.status.checkedIn'),
      icon: LogIn,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    checked_out: {
      label: t('booking.status.checkedOut'),
      icon: LogOut,
      color: 'text-slate-400',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/20',
    },
    cancelled: {
      label: t('booking.status.cancelled'),
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
    expired: {
      label: t('booking.status.expired'),
      icon: XCircle,
      color: 'text-slate-500',
      bg: 'bg-slate-600/10',
      border: 'border-slate-600/20',
    },
    outsourced: {
      label: t('booking.status.outsourced'),
      icon: Hotel,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
  }

  const canManageBookings =
    profile?.role === 'room_admin' ||
    (hotelAssignment &&
      bookingDetail &&
      hotelAssignment.hotelId === bookingDetail.hotel._id &&
      ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role))

  const canVerifyPayment =
    bookingDetail &&
    hotelAssignment?.hotelId === bookingDetail.hotel._id &&
    ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role)

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

  const handleVerifyPayment = async () => {
    if (!user?.id) return
    if (!window.confirm(t('admin.bookings.confirmApprovePayment'))) return
    await verifyPayment({ clerkUserId: user.id, bookingId: typedBookingId })
  }

  const handleRejectPayment = async () => {
    if (!user?.id) return
    if (!window.confirm(t('admin.bookings.confirmRejectPayment'))) return
    await rejectPayment({ clerkUserId: user.id, bookingId: typedBookingId })
  }

  const handleCopyTransactionId = async () => {
    if (!bookingDetail?.booking.transactionId) return
    await navigator.clipboard.writeText(bookingDetail.booking.transactionId)
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
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            {t('admin.bookings.notFound')}
          </h3>
          <Link
            to="/admin/bookings"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('admin.bookings.backToBookings')}
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
        {t('admin.bookings.backToBookings')}
      </Link>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-semibold text-slate-100">
            {t('admin.bookings.detailPageTitle')}
          </h1>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${status.bg} ${status.color} ${status.border} border`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            {status.label}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">{t('admin.bookings.guest')}</p>
            <p className="text-slate-100 font-medium">
              {bookingDetail.guestProfile?.name ||
                bookingDetail.booking.guestName ||
                t('admin.bookings.na')}
            </p>
            <p className="text-slate-400">
              {bookingDetail.guestProfile?.phone || t('admin.bookings.noPhone')}
            </p>
            <p className="text-slate-400">
              {bookingDetail.guestProfile?.email ||
                bookingDetail.booking.guestEmail ||
                t('admin.bookings.noEmail')}
            </p>
            {bookingDetail.linkedUser && (
              <p className="text-xs text-slate-500 mt-1">
                {t('admin.bookings.linkedAccount')}:{' '}
                {bookingDetail.linkedUser.email}
              </p>
            )}
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">{t('hotel.room')}</p>
            <p className="text-slate-100 font-medium">
              {t('hotel.room')} {bookingDetail.room.roomNumber}
            </p>
            <p className="text-slate-400 capitalize">
              {bookingDetail.room.type}
            </p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">{t('admin.nav.hotels')}</p>
            <p className="text-slate-100 font-medium">
              {bookingDetail.hotel.name}
            </p>
            <p className="text-slate-400">
              {bookingDetail.hotel.address}, {bookingDetail.hotel.city}
            </p>
          </div>
          {bookingDetail.booking.status === 'outsourced' && (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-500 mb-1">
                {t('admin.bookings.outsourcedTo')}
              </p>
              <p className="text-slate-100 font-medium">
                {outsourcedToHotel?.name ||
                  t('admin.bookings.unknownDestination')}
              </p>
              <p className="text-slate-400">
                {outsourcedToHotel
                  ? `${outsourcedToHotel.city}, ${outsourcedToHotel.country}`
                  : t('admin.bookings.destinationUnavailable')}
              </p>
            </div>
          )}
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">{t('admin.bookings.stay')}</p>
            <p className="text-slate-100 font-medium">
              {bookingDetail.booking.checkIn} → {bookingDetail.booking.checkOut}
            </p>
            <p className="text-slate-400">
              ${(bookingDetail.booking.totalPrice / 100).toFixed(2)}
            </p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">{t('admin.bookings.payment')}</p>
            <p className="text-slate-100 font-medium capitalize">
              {bookingDetail.booking.paymentStatus ||
                t('admin.bookings.pending')}
            </p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-500 mb-1">{t('booking.package')}</p>
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
              <p className="text-slate-500 mb-1">
                {t('bookingModal.specialRequests')}
              </p>
              <p className="text-slate-300">
                {bookingDetail.booking.specialRequests}
              </p>
            </div>
          )}
        </div>
      </div>

      {canVerifyPayment && bookingDetail.booking.status === 'pending_payment' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">
            {t('admin.bookings.paymentVerification')}
          </h2>

          <div className="space-y-4">
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-500 mb-1">
                {t('admin.bookings.transactionId')}
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-slate-100 font-medium break-all">
                  {bookingDetail.booking.transactionId || t('admin.bookings.na')}
                </p>
                {bookingDetail.booking.transactionId && (
                  <button
                    type="button"
                    onClick={handleCopyTransactionId}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    {t('common.copy')}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-500 mb-2">{t('admin.bookings.nationalId')}</p>
              {nationalIdImageUrl ? (
                <img
                  src={nationalIdImageUrl}
                  alt={t('admin.bookings.nationalId')}
                  className="w-full max-h-80 object-contain rounded-lg border border-slate-700 bg-slate-900"
                />
              ) : (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Image className="w-4 h-4" />
                  <span>{t('admin.bookings.nationalIdUnavailable')}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleVerifyPayment}
                className="px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors text-sm font-medium border border-emerald-500/20 inline-flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {t('admin.bookings.approvePayment')}
              </button>
              <button
                onClick={handleRejectPayment}
                className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium border border-red-500/20 inline-flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                {t('admin.bookings.rejectPayment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {canManageBookings && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">
            {t('admin.bookings.actions')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {bookingDetail.booking.paymentStatus !== 'paid' &&
              ['confirmed', 'checked_in'].includes(bookingDetail.booking.status) && (
                <button
                  onClick={handleAcceptCashPayment}
                  className="px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors text-sm font-medium border border-emerald-500/20 inline-flex items-center gap-2"
                >
                  <CircleDollarSign className="w-4 h-4" />
                  {t('admin.bookings.acceptCashPayment')}
                </button>
              )}

            {profile?.role !== 'room_admin' &&
              ['confirmed', 'checked_in'].includes(
                bookingDetail.booking.status,
              ) && (
                <button
                  onClick={() => setShowOutsourceModal(true)}
                  className="px-3 py-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-medium border border-purple-500/20 inline-flex items-center gap-2"
                >
                  <Hotel className="w-4 h-4" />
                  {t('admin.bookings.outsource')}
                </button>
              )}

            {getAllowedTransitions(bookingDetail.booking.status).map(
              (nextStatus) => (
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
              ),
            )}
          </div>
        </div>
      )}

      {showOutsourceModal && bookingDetail && (
        <OutsourceModal
          bookingDetail={bookingDetail}
          clerkUserId={user?.id || ''}
          onClose={() => setShowOutsourceModal(false)}
          onSuccess={() => setShowOutsourceModal(false)}
        />
      )}
    </div>
  )
}
