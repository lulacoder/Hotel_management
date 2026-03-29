// Customer bookings route with filtering and list rendering.
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Loader2,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../../../convex/_generated/api'
import { useI18n } from '../../lib/i18n'
import { DEFAULT_SELECT_LOCATION_SEARCH } from '../../lib/navigationSearch'

import { BookingsHeader } from './bookings/components/-BookingsHeader'
import { BookingsFilters } from './bookings/components/-BookingsFilters'
import { BookingsList } from './bookings/components/-BookingsList'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/bookings')({
  validateSearch: (search: Record<string, unknown>) => ({
    payment:
      typeof search.payment === 'string' && search.payment
        ? search.payment
        : undefined,
    tx_ref:
      typeof search.tx_ref === 'string' && search.tx_ref
        ? search.tx_ref
        : undefined,
  }),
  component: BookingsPage,
  // Child route mounted under authenticated layout for customer booking history.
})

function BookingsPage() {
  const { user } = useUser()
  // Load current user profile/bookings and derive filter-ready display data.
  const { t } = useI18n()
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [dismissedPaymentRef, setDismissedPaymentRef] = useState<string | null>(
    null,
  )
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const bookings = useQuery(
    api.bookings.getMyBookingsEnriched,
    user?.id ? {} : 'skip',
  )
  const trackedPayment = useQuery(
    api.chapaQueries.getCheckoutStatus,
    user?.id && search.payment === 'processing' && search.tx_ref
      ? { txRef: search.tx_ref }
      : 'skip',
  )

  const cancelBooking = useMutation(api.bookings.cancelBooking)

  useEffect(() => {
    setDismissedPaymentRef(null)
  }, [search.payment, search.tx_ref])

  const handleCancel = async (bookingId: Id<'bookings'>) => {
    if (!user?.id) return

    const confirmed = window.confirm(t('bookings.confirmCancel'))
    if (!confirmed) return

    setCancellingId(bookingId)
    try {
      await cancelBooking({
        bookingId,
      })
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      alert(t('bookings.cancelFailed'))
    } finally {
      setCancellingId(null)
    }
  }

  const filteredBookings = bookings?.filter((b) => {
    if (statusFilter === 'all') return true
    return b.booking.status === statusFilter
  })

  const isLoading = bookings === undefined
  const showPaymentBanner =
    search.payment === 'processing' &&
    Boolean(search.tx_ref) &&
    dismissedPaymentRef !== search.tx_ref

  const clearPaymentSearch = () => {
    setDismissedPaymentRef(search.tx_ref ?? null)
    navigate({
      to: '/bookings',
      replace: true,
      search: (prev) => ({
        ...prev,
        payment: undefined,
        tx_ref: undefined,
      }),
    })
  }

  const paymentBanner =
    !trackedPayment || trackedPayment.status === 'initialized'
      ? {
          Icon: Loader2,
          body: t('bookingModal.paymentProcessingMessage'),
          className: 'bg-violet-500/10 border-violet-500/20 text-violet-300',
          iconClassName: 'text-violet-400 animate-spin',
          title: t('bookingModal.paymentProcessingTitle'),
        }
      : trackedPayment.status === 'paid'
        ? {
            Icon: CheckCircle,
            body: t('bookingModal.paymentSuccessMessage'),
            className:
              'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
            iconClassName: 'text-emerald-400',
            title: t('bookingModal.paymentSuccessTitle'),
          }
        : trackedPayment.status === 'refund_required' ||
            trackedPayment.status === 'refund_initiated'
          ? {
              Icon: AlertTriangle,
              body: t('bookingModal.paymentRefundRequiredMessage'),
              className: 'bg-amber-500/10 border-amber-500/20 text-amber-100',
              iconClassName: 'text-amber-400',
              title: t('bookingModal.paymentRefundRequiredTitle'),
            }
          : trackedPayment.status === 'refunded'
            ? {
                Icon: AlertTriangle,
                body: t('bookingModal.paymentRefundedMessage'),
                className: 'bg-slate-800 border-slate-700 text-slate-200',
                iconClassName: 'text-slate-300',
                title: t('bookingModal.paymentRefundedTitle'),
              }
            : trackedPayment.status === 'reversed'
              ? {
                  Icon: AlertTriangle,
                  body: t('bookingModal.paymentReversedMessage'),
                  className:
                    'bg-amber-500/10 border-amber-500/20 text-amber-100',
                  iconClassName: 'text-amber-400',
                  title: t('bookingModal.paymentReversedTitle'),
                }
              : {
                  Icon: XCircle,
                  body: t('bookingModal.paymentFailedMessage'),
                  className: 'bg-red-500/10 border-red-500/20 text-red-200',
                  iconClassName: 'text-red-400',
                  title: t('bookingModal.paymentFailedTitle'),
                }
  const PaymentBannerIcon = paymentBanner.Icon

  return (
    <div className="min-h-screen bg-slate-950">
      <BookingsHeader
        userName={
          user?.firstName || user?.emailAddresses[0]?.emailAddress || ''
        }
      />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {showPaymentBanner && (
          <div
            className={`mb-6 rounded-2xl border p-4 ${paymentBanner.className}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <PaymentBannerIcon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${paymentBanner.iconClassName}`}
                />
                <div>
                  <p className="font-semibold">{paymentBanner.title}</p>
                  <p className="mt-1 text-sm opacity-90">
                    {paymentBanner.body}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearPaymentSearch}
                className="rounded-lg p-1 text-current/80 transition-colors hover:bg-black/10 hover:text-current"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Filter */}
        <BookingsFilters
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredBookings?.length === 0 && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800/50 p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              {statusFilter === 'all'
                ? t('bookings.noBookingsYet')
                : t('bookings.noStatusBookings', {
                    status: statusFilter.replace('_', ' '),
                  })}
            </h2>
            <p className="text-slate-400 mb-6">
              {statusFilter === 'all'
                ? t('bookings.startSelectingLocation')
                : t('bookings.tryChangingFilter')}
            </p>
            <Link
              to="/select-location"
              search={DEFAULT_SELECT_LOCATION_SEARCH}
              className="inline-flex items-center px-6 py-3 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-colors"
            >
              {t('bookings.browseHotels')}
            </Link>
          </div>
        )}

        {/* Bookings List */}
        {!isLoading && filteredBookings && filteredBookings.length > 0 && (
          <BookingsList
            bookings={filteredBookings}
            cancellingId={cancellingId}
            onCancel={handleCancel}
          />
        )}
      </main>
    </div>
  )
}
