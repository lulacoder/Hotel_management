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
import { motion } from 'motion/react'

import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '@/lib/theme'
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

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut' as const },
  },
}

const etbCurrencyFormatter = new Intl.NumberFormat('en-ET', {
  currency: 'ETB',
  style: 'currency',
})

function formatEtbAmount(amountMinor: number) {
  return etbCurrencyFormatter.format(amountMinor / 100)
}

function BookingDetailPage() {
  // Fetch booking graph + role context used for permissions and actions.
  const { bookingId } = Route.useParams()
  const typedBookingId = bookingId as Id<'bookings'>
  const { user } = useUser()
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [showOutsourceModal, setShowOutsourceModal] = useState(false)

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  const bookingDetail = useQuery(
    api.bookings.getEnriched,
    user?.id ? { bookingId: typedBookingId } : 'skip',
  )
  const chapaPayment = useQuery(
    api.chapaQueries.getPaymentForBooking,
    user?.id ? { bookingId: typedBookingId } : 'skip',
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
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    pending_payment: {
      label: t('booking.status.pendingPayment'),
      icon: Clock,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
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
      bookingId: typedBookingId,
      nextStatus,
    })
  }

  const handleAcceptCashPayment = async () => {
    if (!user?.id) return
    await acceptCashPayment({ bookingId: typedBookingId })
  }

  const handleVerifyPayment = async () => {
    if (!user?.id) return
    if (!window.confirm(t('admin.bookings.confirmApprovePayment'))) return
    await verifyPayment({ bookingId: typedBookingId })
  }

  const handleRejectPayment = async () => {
    if (!user?.id) return
    if (!window.confirm(t('admin.bookings.confirmRejectPayment'))) return
    await rejectPayment({ bookingId: typedBookingId })
  }

  const handleCopyTransactionId = async () => {
    if (!bookingDetail?.booking.transactionId) return
    await navigator.clipboard.writeText(bookingDetail.booking.transactionId)
  }

  if (bookingDetail === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-violet-500/20 border-t-violet-500' : 'border-violet-500/20 border-t-violet-500'}`}
        ></div>
      </div>
    )
  }

  if (bookingDetail === null) {
    return (
      <div className="max-w-4xl mx-auto">
        <div
          className={`border rounded-2xl p-12 text-center backdrop-blur-sm ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}
        >
          <h3
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            {t('admin.bookings.notFound')}
          </h3>
          <Link
            to="/admin/bookings"
            search={{ status: 'all', paymentStatus: 'all', window: '30d' }}
            className={`inline-flex items-center gap-2 px-5 py-2.5 font-medium rounded-xl transition-colors ${isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
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
    <motion.div
      className="max-w-4xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <Link
          to="/admin/bookings"
          search={{ status: 'all', paymentStatus: 'all', window: '30d' }}
          className={`inline-flex items-center gap-2 transition-colors mb-6 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('admin.bookings.backToBookings')}
        </Link>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={`border rounded-2xl p-6 mb-6 backdrop-blur-sm ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1
            className={`text-2xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
            style={{ fontFamily: 'var(--font-heading)' }}
          >
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
          <div
            className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <p
              className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {t('admin.bookings.guest')}
            </p>
            <p
              className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
            >
              {bookingDetail.guestProfile?.name ||
                bookingDetail.booking.guestName ||
                t('admin.bookings.na')}
            </p>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {bookingDetail.guestProfile?.phone || t('admin.bookings.noPhone')}
            </p>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {bookingDetail.guestProfile?.email ||
                bookingDetail.booking.guestEmail ||
                t('admin.bookings.noEmail')}
            </p>
            {bookingDetail.linkedUser && (
              <p
                className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.bookings.linkedAccount')}:{' '}
                {bookingDetail.linkedUser.email}
              </p>
            )}
          </div>
          <div
            className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <p
              className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {t('hotel.room')}
            </p>
            <p
              className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
            >
              {t('hotel.room')} {bookingDetail.room.roomNumber}
            </p>
            <p
              className={`capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              {bookingDetail.room.type}
            </p>
          </div>
          <div
            className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <p
              className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {t('admin.nav.hotels')}
            </p>
            <p
              className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
            >
              {bookingDetail.hotel.name}
            </p>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {bookingDetail.hotel.address}, {bookingDetail.hotel.city}
            </p>
          </div>
          {bookingDetail.booking.status === 'outsourced' && (
            <div
              className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
            >
              <p
                className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.bookings.outsourcedTo')}
              </p>
              <p
                className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
              >
                {outsourcedToHotel?.name ||
                  t('admin.bookings.unknownDestination')}
              </p>
              <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                {outsourcedToHotel
                  ? `${outsourcedToHotel.city}, ${outsourcedToHotel.country}`
                  : t('admin.bookings.destinationUnavailable')}
              </p>
            </div>
          )}
          <div
            className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <p
              className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {t('admin.bookings.stay')}
            </p>
            <p
              className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
            >
              {bookingDetail.booking.checkIn} → {bookingDetail.booking.checkOut}
            </p>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              ${(bookingDetail.booking.totalPrice / 100).toFixed(2)}
            </p>
          </div>
          <div
            className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <p
              className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {t('admin.bookings.payment')}
            </p>
            <p
              className={`font-medium capitalize ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
            >
              {bookingDetail.booking.paymentStatus ||
                t('admin.bookings.pending')}
            </p>
          </div>
          <div
            className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <p
              className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {t('booking.package')}
            </p>
            <p
              className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
            >
              {getPackageLabelOrDefault(bookingDetail.booking.packageType, t)}
            </p>
            {bookingDetail.booking.packageType && (
              <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                {formatPackageAddOn(bookingDetail.booking.packageAddOn ?? 0, t)}
              </p>
            )}
          </div>
          {bookingDetail.booking.specialRequests && (
            <div
              className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
            >
              <p
                className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('bookingModal.specialRequests')}
              </p>
              <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                {bookingDetail.booking.specialRequests}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {chapaPayment && (
        <motion.div
          variants={itemVariants}
          className={`border rounded-2xl p-6 mb-6 backdrop-blur-sm ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}
        >
          <h2
            className={`text-lg font-semibold mb-4 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
          >
            {t('admin.bookings.chapaPayment')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div
              className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
            >
              <p
                className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.bookings.paymentProvider')}
              </p>
              <p
                className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
              >
                Chapa
              </p>
              <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                {chapaPayment.paymentMethod || t('admin.bookings.na')}
              </p>
            </div>

            <div
              className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
            >
              <p
                className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.bookings.providerStatus')}
              </p>
              <p
                className={`font-medium capitalize ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
              >
                {chapaPayment.status.replaceAll('_', ' ')}
              </p>
              <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                {chapaPayment.providerMode || t('admin.bookings.na')}
              </p>
            </div>

            <div
              className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
            >
              <p
                className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.bookings.checkoutReference')}
              </p>
              <p
                className={`font-medium break-all ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
              >
                {chapaPayment.chapaReference || chapaPayment.txRef}
              </p>
              <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                tx_ref: {chapaPayment.txRef}
              </p>
            </div>

            <div
              className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
            >
              <p
                className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.bookings.chargedAmount')}
              </p>
              <p
                className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
              >
                {formatEtbAmount(chapaPayment.chargedAmountMinor)}
              </p>
              <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                {t('admin.bookings.fxRate')}: {chapaPayment.fxRateEtbPerUsd}{' '}
                ETB/USD
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {canVerifyPayment &&
        bookingDetail.booking.status === 'pending_payment' && (
          <motion.div
            variants={itemVariants}
            className={`border rounded-2xl p-6 mb-6 backdrop-blur-sm ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}
          >
            <h2
              className={`text-lg font-semibold mb-4 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
            >
              {t('admin.bookings.paymentVerification')}
            </h2>

            <div className="space-y-4">
              <div
                className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <p
                  className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {t('admin.bookings.transactionId')}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`font-medium break-all ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                  >
                    {bookingDetail.booking.transactionId ||
                      t('admin.bookings.na')}
                  </p>
                  {bookingDetail.booking.transactionId && (
                    <button
                      type="button"
                      onClick={handleCopyTransactionId}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border text-sm ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'}`}
                    >
                      <Copy className="w-4 h-4" />
                      {t('common.copy')}
                    </button>
                  )}
                </div>
              </div>

              <div
                className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <p
                  className={`mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {t('admin.bookings.nationalId')}
                </p>
                {nationalIdImageUrl ? (
                  <img
                    src={nationalIdImageUrl}
                    alt={t('admin.bookings.nationalId')}
                    className={`w-full max-h-80 object-contain rounded-lg border ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}
                  />
                ) : (
                  <div
                    className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                  >
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
          </motion.div>
        )}

      {canManageBookings && (
        <motion.div
          variants={itemVariants}
          className={`border rounded-2xl p-6 backdrop-blur-sm ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}
        >
          <h2
            className={`text-lg font-semibold mb-4 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
          >
            {t('admin.bookings.actions')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {bookingDetail.booking.paymentStatus !== 'paid' &&
              ['confirmed', 'checked_in'].includes(
                bookingDetail.booking.status,
              ) && (
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
                      : 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border-violet-500/20'
                  }`}
                >
                  {transitionLabel[nextStatus]}
                </button>
              ),
            )}
          </div>
        </motion.div>
      )}

      {showOutsourceModal && bookingDetail && (
        <OutsourceModal
          bookingDetail={bookingDetail}
          onClose={() => setShowOutsourceModal(false)}
          onSuccess={() => setShowOutsourceModal(false)}
        />
      )}
    </motion.div>
  )
}
