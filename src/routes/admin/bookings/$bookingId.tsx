// Booking details route for a specific booking record in the admin area.
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowLeft,
  CheckCircle,
  CircleDollarSign,
  Copy,
  Hotel,
  Image,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { m } from 'motion/react'

import { api } from '../../../../convex/_generated/api'
import { getAllowedBookingTransitions } from '../../../../convex/lib/bookingLifecycle'
import { useAdminSession } from '../../../lib/adminSession'
import { useI18n } from '../../../lib/i18n/provider'
import {
  formatPackageAddOn,
  getPackageLabelOrDefault,
} from '../../../lib/packages'
import { OutsourceModal } from './components/-OutsourceModal'
import { BookingStatusBadge } from './components/-BookingStatusBadge'
import type { ManualBookingTransitionStatus } from '../../../../convex/lib/bookingLifecycle'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useTheme } from '@/lib/theme'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useAction, useMutation, useQuery } from '@/integrations/convex/hooks'
import { AdminSpinner } from '@/components/AdminSpinner'
import { formatEtbAmount, formatUsdAmount } from '@/lib/currency'
import {
  getRefundStatusLabelKey,
  useBookingStatusConfig,
} from '@/lib/bookingStatus'

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

// Formats stored refund timestamps in the staff member's local time
function formatRefundTimestamp(timestamp: number | undefined): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '—'
}

function BookingDetailPage() {
  // Fetch booking graph + role context used for permissions and actions.
  const { bookingId } = Route.useParams()
  const typedBookingId = bookingId as Id<'bookings'>
  const { t } = useI18n()
  const confirm = useConfirm()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [showOutsourceModal, setShowOutsourceModal] = useState(false)
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [refundFeedback, setRefundFeedback] = useState<string | null>(null)

  const { hotelAssignment, profile } = useAdminSession()

  const bookingDetail = useQuery(api.bookings.getEnriched, {
    bookingId: typedBookingId,
  })
  const chapaPayment = useQuery(api.chapaQueries.getPaymentForBooking, {
    bookingId: typedBookingId,
  })
  const outsourcedToHotel = useQuery(
    api.hotels.get,
    bookingDetail?.booking.outsourcedToHotelId
      ? { hotelId: bookingDetail.booking.outsourcedToHotelId }
      : 'skip',
  )

  const updateBookingStatus = useMutation(api.bookings.updateStatus)
  const cancelBooking = useMutation(api.bookings.cancelBooking)
  const cancelPaidBooking = useMutation(api.bookings.cancelPaidBooking)
  const acceptCashPayment = useMutation(api.bookings.acceptCashPayment)
  const verifyPayment = useMutation(api.bookings.verifyPayment)
  const rejectPayment = useMutation(api.bookings.rejectPayment)
  const initiateRefund = useAction(api.chapaActions.initiateRefund)
  const completeManualRefund = useMutation(api.bookings.completeManualRefund)

  const legacyNationalIdImageUrl = useQuery(
    api.files.getFileUrl,
    bookingDetail?.booking.nationalIdStorageId
      ? { storageId: bookingDetail.booking.nationalIdStorageId }
      : 'skip',
  )
  const r2NationalIdMetadata = useQuery(
    api.r2.getMetadata,
    bookingDetail?.booking.nationalIdR2Key
      ? { key: bookingDetail.booking.nationalIdR2Key }
      : 'skip',
  )
  const nationalIdImageUrl =
    r2NationalIdMetadata?.url ?? legacyNationalIdImageUrl

  const { statusConfig, transitionLabel } = useBookingStatusConfig()
  const refundStatusLabelKey = getRefundStatusLabelKey(
    bookingDetail?.booking.refundStatus,
  )

  const canManageBookings =
    profile.role === 'room_admin' ||
    (hotelAssignment &&
      bookingDetail &&
      hotelAssignment.hotelId === bookingDetail.hotel._id &&
      ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role))

  const canVerifyPayment =
    bookingDetail &&
    hotelAssignment?.hotelId === bookingDetail.hotel._id &&
    ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role)

  const canExecuteRefund =
    profile.role === 'room_admin' ||
    Boolean(
      hotelAssignment &&
      bookingDetail &&
      hotelAssignment.hotelId === bookingDetail.hotel._id &&
      hotelAssignment.role === 'hotel_admin',
    )

  const handleStatusChange = async (
    nextStatus: ManualBookingTransitionStatus,
  ) => {
    // Paid bookings cancel through the staff refund path so the money stays tracked
    if (nextStatus === 'cancelled') {
      if (bookingDetail?.booking.paymentStatus === 'paid') {
        const confirmed = await confirm({
          title: t('admin.bookings.cancelAndFlagRefund'),
          description: t('admin.bookings.confirmCancelPaid'),
          confirmText: t('admin.bookings.cancelAndFlagRefund'),
          cancelText: t('common.cancel'),
          variant: 'destructive',
        })
        if (!confirmed) return
        await cancelPaidBooking({ bookingId: typedBookingId })
        return
      }

      const confirmed = await confirm({
        title: t('booking.cancel'),
        description: t('bookings.confirmCancel'),
        confirmText: t('booking.cancel'),
        cancelText: t('common.cancel'),
        variant: 'destructive',
      })
      if (!confirmed) return
      await cancelBooking({ bookingId: typedBookingId })
      return
    }

    await updateBookingStatus({
      bookingId: typedBookingId,
      nextStatus,
    })
  }

  const handleAcceptCashPayment = async () => {
    await acceptCashPayment({ bookingId: typedBookingId })
  }

  const handleVerifyPayment = async () => {
    const confirmed = await confirm({
      title: t('admin.bookings.approvePayment'),
      description: t('admin.bookings.confirmApprovePayment'),
      confirmText: t('admin.bookings.approvePayment'),
      cancelText: t('common.cancel'),
      variant: 'success',
    })
    if (!confirmed) return
    await verifyPayment({ bookingId: typedBookingId })
  }

  const handleRejectPayment = async () => {
    const confirmed = await confirm({
      title: t('admin.bookings.rejectPayment'),
      description: t('admin.bookings.confirmRejectPayment'),
      confirmText: t('admin.bookings.rejectPayment'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
    })
    if (!confirmed) return
    await rejectPayment({ bookingId: typedBookingId })
  }

  const handleCopyTransactionId = async () => {
    if (!bookingDetail?.booking.transactionId) return
    await navigator.clipboard.writeText(bookingDetail.booking.transactionId)
  }

  // Executes the explicit full refund selected by an authorized administrator
  const handleRefund = async () => {
    if (!bookingDetail?.booking.refundMethod) return

    const isChapa = bookingDetail.booking.refundMethod === 'chapa'
    const amount = isChapa
      ? formatEtbAmount(chapaPayment?.chargedAmountMinor ?? 0)
      : formatUsdAmount(bookingDetail.booking.totalPrice)
    const confirmation = isChapa
      ? `Issue a full ${amount} refund through Chapa? This moves real money.`
      : `Confirm that the full ${amount} manual refund has been paid?`

    const confirmed = await confirm({
      title: isChapa ? 'Issue Chapa Refund' : 'Confirm Manual Refund',
      description: confirmation,
      confirmText: isChapa ? 'Issue Refund' : 'Confirm Refund',
      cancelText: t('common.cancel'),
      variant: 'warning',
    })
    if (!confirmed) return

    setRefundSubmitting(true)
    setRefundFeedback(null)
    try {
      if (isChapa) {
        const result = await initiateRefund({ bookingId: typedBookingId })
        setRefundFeedback(
          result.error ??
            (result.state === 'refunded'
              ? t('admin.bookings.refundCompleted')
              : t('admin.bookings.refundProcessing')),
        )
      } else {
        await completeManualRefund({ bookingId: typedBookingId })
        setRefundFeedback(t('admin.bookings.refundCompleted'))
      }
    } catch (error) {
      setRefundFeedback(
        error instanceof Error
          ? error.message
          : t('admin.bookings.refundActionFailed'),
      )
    } finally {
      setRefundSubmitting(false)
    }
  }

  if (bookingDetail === undefined) {
    return <AdminSpinner />
  }

  if (bookingDetail === null) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="admin-empty-state p-12">
          <h3
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            {t('admin.bookings.notFound')}
          </h3>
          <Button asChild variant="outline">
            <Link
              to="/admin/bookings"
              search={{ status: 'all', paymentStatus: 'all', window: '30d' }}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              {t('admin.bookings.backToBookings')}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <m.div
      className="max-w-4xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <m.div variants={itemVariants}>
        <Link
          to="/admin/bookings"
          search={{ status: 'all', paymentStatus: 'all', window: '30d' }}
          className={`inline-flex items-center gap-2 transition-colors mb-6 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <ArrowLeft className="size-4" />
          {t('admin.bookings.backToBookings')}
        </Link>
      </m.div>

      <m.div variants={itemVariants} className="admin-surface p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1
            className={`text-2xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {t('admin.bookings.detailPageTitle')}
          </h1>
          <BookingStatusBadge
            status={bookingDetail.booking.status}
            statusConfig={statusConfig}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="admin-surface-muted p-4">
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
          <div className="admin-surface-muted p-4">
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
          <div className="admin-surface-muted p-4">
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
            <div className="admin-surface-muted p-4">
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
          <div className="admin-surface-muted p-4">
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
              {formatUsdAmount(bookingDetail.booking.totalPrice)}
            </p>
          </div>
          <div className="admin-surface-muted p-4">
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
            {refundStatusLabelKey && (
              <p className="mt-1 text-sm font-medium text-amber-400">
                {t(refundStatusLabelKey)}
              </p>
            )}
          </div>
          <div className="admin-surface-muted p-4">
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
            <div className="admin-surface-muted p-4">
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
      </m.div>

      {chapaPayment && (
        <m.div variants={itemVariants} className="admin-surface p-6 mb-6">
          <h2
            className={`text-lg font-semibold mb-4 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
          >
            {t('admin.bookings.chapaPayment')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="admin-surface-muted p-4">
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

            <div className="admin-surface-muted p-4">
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

            <div className="admin-surface-muted p-4">
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

            <div className="admin-surface-muted p-4">
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
        </m.div>
      )}

      {bookingDetail.booking.refundStatus && (
        <m.div variants={itemVariants} className="admin-surface p-6 mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                className={`text-lg font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
              >
                {t('admin.bookings.refundStatus')}
              </h2>
              <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                {refundStatusLabelKey ? t(refundStatusLabelKey) : ''}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                bookingDetail.booking.refundStatus === 'refunded'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : bookingDetail.booking.refundStatus === 'processing'
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                    : bookingDetail.booking.refundStatus === 'required'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
              }`}
            >
              {bookingDetail.booking.refundStatus.replaceAll('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div className="admin-surface-muted p-4">
              <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                {t('admin.bookings.refundMethod')}
              </p>
              <p className={isDark ? 'text-slate-100' : 'text-slate-800'}>
                {bookingDetail.booking.refundMethod === 'chapa'
                  ? 'Chapa'
                  : t('admin.bookings.refundMethodManual')}
              </p>
            </div>
            <div className="admin-surface-muted p-4">
              <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                {t('admin.bookings.refundReason')}
              </p>
              <p className="capitalize text-amber-400">
                {bookingDetail.booking.refundReason?.replaceAll('_', ' ') ||
                  '—'}
              </p>
            </div>
            <div className="admin-surface-muted p-4">
              <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                {t('admin.bookings.refundRequiredAt')}
              </p>
              <p className={isDark ? 'text-slate-100' : 'text-slate-800'}>
                {formatRefundTimestamp(bookingDetail.booking.refundRequiredAt)}
              </p>
            </div>
            <div className="admin-surface-muted p-4">
              <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                {t('admin.bookings.refundAmount')}
              </p>
              <p className={isDark ? 'text-slate-100' : 'text-slate-800'}>
                {bookingDetail.booking.refundMethod === 'chapa' && chapaPayment
                  ? formatEtbAmount(chapaPayment.chargedAmountMinor)
                  : formatUsdAmount(bookingDetail.booking.totalPrice)}
              </p>
            </div>
          </div>

          {(bookingDetail.booking.refundLastError ||
            bookingDetail.booking.refundStatus === 'verification_required') && (
            <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-400">
              {bookingDetail.booking.refundLastError ||
                t('admin.bookings.refundVerificationWarning')}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canExecuteRefund &&
              ['required', 'reversed'].includes(
                bookingDetail.booking.refundStatus,
              ) && (
                <button
                  type="button"
                  onClick={handleRefund}
                  disabled={refundSubmitting}
                  className="admin-button-soft inline-flex items-center gap-2 px-4 py-2 text-sm text-amber-400 disabled:opacity-50"
                >
                  {refundSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  {bookingDetail.booking.refundMethod === 'chapa'
                    ? t('admin.bookings.issueChapaRefund')
                    : t('admin.bookings.completeManualRefund')}
                </button>
              )}
            {!canExecuteRefund &&
              bookingDetail.booking.refundStatus !== 'refunded' && (
                <p className="text-sm text-slate-400">
                  {t('admin.bookings.cashierRefundReadOnly')}
                </p>
              )}
            {refundFeedback && (
              <p role="status" className="text-sm text-amber-400">
                {refundFeedback}
              </p>
            )}
          </div>
        </m.div>
      )}

      {canVerifyPayment &&
        bookingDetail.booking.status === 'pending_payment' && (
          <m.div variants={itemVariants} className="admin-surface p-6 mb-6">
            <h2
              className={`text-lg font-semibold mb-4 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
            >
              {t('admin.bookings.paymentVerification')}
            </h2>

            <div className="space-y-4">
              <div className="admin-surface-muted p-4">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyTransactionId}
                      className="gap-2"
                    >
                      <Copy className="size-4" />
                      {t('common.copy')}
                    </Button>
                  )}
                </div>
              </div>

              <div className="admin-surface-muted p-4">
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
                    <Image className="size-4" />
                    <span>{t('admin.bookings.nationalIdUnavailable')}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleVerifyPayment}
                  className="admin-button-soft px-3 py-2 text-sm inline-flex items-center gap-2 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                >
                  <CheckCircle className="size-4" />
                  {t('admin.bookings.approvePayment')}
                </button>
                <button
                  type="button"
                  onClick={handleRejectPayment}
                  className="admin-button-destructive px-3 py-2 text-sm inline-flex items-center gap-2"
                >
                  <XCircle className="size-4" />
                  {t('admin.bookings.rejectPayment')}
                </button>
              </div>
            </div>
          </m.div>
        )}

      {canManageBookings && (
        <m.div variants={itemVariants} className="admin-surface p-6">
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
                  type="button"
                  onClick={handleAcceptCashPayment}
                  className="admin-button-soft px-3 py-2 text-sm inline-flex items-center gap-2 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                >
                  <CircleDollarSign className="size-4" />
                  {t('admin.bookings.acceptCashPayment')}
                </button>
              )}

            {profile.role !== 'room_admin' &&
              ['confirmed', 'checked_in'].includes(
                bookingDetail.booking.status,
              ) && (
                <button
                  type="button"
                  onClick={() => setShowOutsourceModal(true)}
                  className="admin-button-soft px-3 py-2 text-sm inline-flex items-center gap-2 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
                >
                  <Hotel className="size-4" />
                  {t('admin.bookings.outsource')}
                </button>
              )}

            {getAllowedBookingTransitions(bookingDetail.booking.status).map(
              (nextStatus) => (
                <button
                  type="button"
                  key={nextStatus}
                  onClick={() => handleStatusChange(nextStatus)}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium border ${
                    nextStatus === 'cancelled'
                      ? 'admin-button-destructive'
                      : 'admin-button-soft'
                  }`}
                >
                  {nextStatus === 'cancelled' &&
                  bookingDetail.booking.paymentStatus === 'paid'
                    ? t('admin.bookings.cancelAndFlagRefund')
                    : transitionLabel[nextStatus]}
                </button>
              ),
            )}
          </div>
        </m.div>
      )}

      {showOutsourceModal && (
        <OutsourceModal
          bookingDetail={bookingDetail}
          onClose={() => setShowOutsourceModal(false)}
          onSuccess={() => setShowOutsourceModal(false)}
        />
      )}
    </m.div>
  )
}
