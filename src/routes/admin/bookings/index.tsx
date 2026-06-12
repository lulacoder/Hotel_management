// Admin bookings list route with filtering and booking management actions.
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
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
import { useEffect, useMemo, useState } from 'react'
import { m } from 'motion/react'
import { api } from '../../../../convex/_generated/api'
import { getAllowedBookingTransitions } from '../../../../convex/lib/bookingLifecycle'
import { useI18n } from '../../../lib/i18n/provider'
import { useAdminSession } from '../../../lib/adminSession'
import {
  normalizeAnalyticsWindow,
  normalizeBookingStatusFilter,
  normalizePaymentStatusFilter,
} from '../../../lib/adminAnalytics'
import {
  formatPackageAddOn,
  getPackageLabelOrDefault,
} from '../../../lib/packages'
import { OutsourceModal } from './components/-OutsourceModal'
import type { ManualBookingTransitionStatus } from '../../../../convex/lib/bookingLifecycle'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useTheme } from '@/lib/theme'
import {
  useMutation,
  usePaginatedQuery,
  useQuery,
} from '@/integrations/convex/hooks'
import { Button } from '@/components/ui/button'
import { LoadMoreButton } from '@/components/LoadMoreButton'

export const Route = createFileRoute('/admin/bookings/')({
  validateSearch: (search: Record<string, unknown>) => ({
    status: normalizeBookingStatusFilter(search.status),
    paymentStatus: normalizePaymentStatusFilter(search.paymentStatus),
    window: normalizeAnalyticsWindow(search.window),
  }),
  // Register admin bookings list route with filtering and bulk operations.
  component: BookingsPage,
})

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
}

const etbCurrencyFormatter = new Intl.NumberFormat('en-ET', {
  currency: 'ETB',
  style: 'currency',
})

function formatEtbAmount(amountMinor: number) {
  return etbCurrencyFormatter.format(amountMinor / 100)
}

type AdminBookingListItem = {
  booking: any
  guestProfile?: {
    _id: Id<'guestProfiles'>
    name: string
    phone?: string
    email?: string
  }
  linkedUser?: {
    _id: Id<'users'>
    email: string
  }
}

function BookingsPage() {
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [statusFilter, setStatusFilter] = useState(search.status)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(
    search.paymentStatus,
  )
  const [selectedHotel, setSelectedHotel] = useState<string>('all')
  const [selectedBookingId, setSelectedBookingId] =
    useState<Id<'bookings'> | null>(null)
  const [outsourceBookingId, setOutsourceBookingId] =
    useState<Id<'bookings'> | null>(null)

  const { hotelAssignment, profile } = useAdminSession()

  const hotels = useQuery(api.hotels.list, {})
  const visibleHotels =
    profile.role === 'room_admin'
      ? hotels
      : hotels?.filter((hotel) => hotel._id === hotelAssignment?.hotelId)

  useEffect(() => {
    if (profile.role !== 'room_admin' && hotelAssignment?.hotelId) {
      setSelectedHotel(hotelAssignment.hotelId)
    }
  }, [profile.role, hotelAssignment?.hotelId])

  useEffect(() => {
    setStatusFilter(search.status)
  }, [search.status])

  useEffect(() => {
    setPaymentStatusFilter(search.paymentStatus)
  }, [search.paymentStatus])

  const bookingsPage = usePaginatedQuery(
    (api as any).bookings.getByHotel,
    {
      hotelId:
        selectedHotel !== 'all' ? (selectedHotel as Id<'hotels'>) : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    },
    { initialNumItems: 20 },
  ) as {
    results: Array<AdminBookingListItem>
    status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'
    loadMore: (numItems: number) => void
  }
  const bookings = bookingsPage.results
  const isBookingsLoading = bookingsPage.status === 'LoadingFirstPage'

  const cancelBooking = useMutation(api.bookings.cancelBooking)
  const updateBookingStatus = useMutation(api.bookings.updateStatus)
  const acceptCashPayment = useMutation(api.bookings.acceptCashPayment)
  const selectedBookingDetail = useQuery(
    api.bookings.getEnriched,
    selectedBookingId ? { bookingId: selectedBookingId } : 'skip',
  )
  const selectedChapaPayment = useQuery(
    api.chapaQueries.getPaymentForBooking,
    selectedBookingId ? { bookingId: selectedBookingId } : 'skip',
  )
  const outsourceBookingDetail = useQuery(
    api.bookings.getEnriched,
    outsourceBookingId ? { bookingId: outsourceBookingId } : 'skip',
  )

  const handleCancel = async (bookingId: Id<'bookings'>) => {
    if (confirm(t('bookings.confirmCancel'))) {
      await cancelBooking({ bookingId })
    }
  }

  const handleStatusChange = async (
    bookingId: Id<'bookings'>,
    nextStatus: ManualBookingTransitionStatus,
  ) => {
    await updateBookingStatus({ bookingId, nextStatus })
  }

  const handleAcceptCashPayment = async (bookingId: Id<'bookings'>) => {
    await acceptCashPayment({ bookingId })
  }

  const transitionLabel: Record<ManualBookingTransitionStatus, string> = {
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
      icon: Ban,
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

  const filteredBookings = useMemo(() => {
    return bookings.filter((item) => {
      if (statusFilter !== 'all' && item.booking.status !== statusFilter) {
        return false
      }

      const bookingPaymentStatus =
        item.booking.paymentStatus ?? 'unpaid_unknown'
      if (
        paymentStatusFilter !== 'all' &&
        bookingPaymentStatus !== paymentStatusFilter
      ) {
        return false
      }

      return true
    })
  }, [bookings, paymentStatusFilter, statusFilter])

  const canManageBooking = (hotelId: Id<'hotels'>) =>
    profile.role === 'room_admin' ||
    (hotelAssignment?.hotelId === hotelId &&
      ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role))

  const updateSearchFilters = (next: {
    status?: typeof statusFilter
    paymentStatus?: typeof paymentStatusFilter
  }) => {
    navigate({
      to: '/admin/bookings',
      search: {
        status: next.status ?? statusFilter,
        paymentStatus: next.paymentStatus ?? paymentStatusFilter,
        window: search.window,
      },
    })
  }

  return (
    <m.div
      className="max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <m.div variants={itemVariants} className="mb-8">
        <h1
          className={`text-3xl font-semibold tracking-tight mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {t('admin.nav.bookings')}
        </h1>
        <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
          {t('admin.bookings.description')}
        </p>
      </m.div>

      {/* Filters */}
      <m.div
        variants={itemVariants}
        className="flex flex-col md:flex-row gap-4 mb-6"
      >
        {/* Hotel Select */}
        <div className="flex-1">
          <select
            value={selectedHotel}
            onChange={(e) => setSelectedHotel(e.target.value)}
            className="admin-select"
          >
            {profile.role === 'room_admin' && (
              <option value="all">{t('admin.bookings.selectHotel')}</option>
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
            onChange={(e) => {
              const value = normalizeBookingStatusFilter(e.target.value)
              setStatusFilter(value)
              updateSearchFilters({ status: value })
            }}
            className="admin-select md:w-48"
          >
            <option value="all">{t('admin.bookings.allStatuses')}</option>
            <option value="held">{t('booking.status.held')}</option>
            <option value="pending_payment">
              {t('booking.status.pendingPayment')}
            </option>
            <option value="confirmed">{t('booking.status.confirmed')}</option>
            <option value="checked_in">{t('booking.status.checkedIn')}</option>
            <option value="checked_out">
              {t('booking.status.checkedOut')}
            </option>
            <option value="cancelled">{t('booking.status.cancelled')}</option>
            <option value="expired">{t('booking.status.expired')}</option>
            <option value="outsourced">{t('booking.status.outsourced')}</option>
          </select>
        </div>

        <div>
          <select
            value={paymentStatusFilter}
            onChange={(e) => {
              const value = normalizePaymentStatusFilter(e.target.value)
              setPaymentStatusFilter(value)
              updateSearchFilters({ paymentStatus: value })
            }}
            className="admin-select md:w-48"
          >
            <option value="all">
              {t('admin.analytics.payment.all' as never)}
            </option>
            <option value="pending">{t('admin.bookings.pending')}</option>
            <option value="paid">
              {t('admin.analytics.payment.paid' as never)}
            </option>
            <option value="failed">
              {t('admin.analytics.payment.failed' as never)}
            </option>
            <option value="refunded">
              {t('admin.analytics.payment.refunded' as never)}
            </option>
            <option value="unpaid_unknown">
              {t('admin.analytics.payment.unknown' as never)}
            </option>
          </select>
        </div>
      </m.div>

      {/* Content */}
      {isBookingsLoading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className={`animate-spin rounded-full size-8 border-2 ${isDark ? 'border-violet-500/20 border-t-violet-500' : 'border-violet-500/20 border-t-violet-500'}`}
          ></div>
        </div>
      ) : filteredBookings.length === 0 ? (
        <m.div variants={itemVariants} className="admin-empty-state p-12">
          <div className="admin-empty-icon">
            <Calendar
              className={`size-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
            />
          </div>
          <h3
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            {t('admin.bookings.noneFound')}
          </h3>
          <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
            {statusFilter !== 'all'
              ? t('admin.bookings.tryStatusFilter')
              : t('admin.bookings.noBookingsForHotel')}
          </p>
        </m.div>
      ) : (
        <m.div className="space-y-4" variants={containerVariants}>
          {filteredBookings.map((item) => {
            const booking = item.booking
            const status =
              statusConfig[booking.status as keyof typeof statusConfig]
            const StatusIcon = status.icon
            const canManageBookings = canManageBooking(booking.hotelId)

            return (
              <m.div key={booking._id} variants={itemVariants}>
                <div
                  className={`admin-surface p-5 transition-all duration-200 ${
                    isDark
                      ? 'hover:border-slate-700/50 hover:bg-slate-900/80'
                      : 'hover:border-slate-300/80 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${status.bg} ${status.color} ${status.border} border`}
                        >
                          <StatusIcon className="size-3.5" />
                          {status.label}
                        </div>
                        {booking.status === 'held' && booking.holdExpiresAt && (
                          <span
                            className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          >
                            {t('admin.bookings.expires')}:{' '}
                            {new Date(
                              booking.holdExpiresAt,
                            ).toLocaleTimeString()}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p
                            className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          >
                            {t('admin.bookings.dates')}
                          </p>
                          <p
                            className={
                              isDark ? 'text-slate-200' : 'text-slate-700'
                            }
                          >
                            {booking.checkIn} → {booking.checkOut}
                          </p>
                        </div>
                        <div>
                          <p
                            className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          >
                            {t('admin.bookings.guest')}
                          </p>
                          <div className="flex items-center gap-2">
                            <p
                              className={
                                isDark ? 'text-slate-200' : 'text-slate-700'
                              }
                            >
                              {item.guestProfile?.name ||
                                booking.guestName ||
                                t('admin.bookings.na')}
                            </p>
                            {item.guestProfile && (
                              <span className="px-2 py-0.5 text-[10px] rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 uppercase tracking-wide">
                                {t('admin.bookings.walkIn')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p
                            className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          >
                            {t('booking.total')}
                          </p>
                          <p
                            className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                          >
                            ${(booking.totalPrice / 100).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p
                            className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          >
                            {t('admin.bookings.payment')}
                          </p>
                          <p
                            className={`capitalize ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                          >
                            {booking.paymentStatus || t('admin.bookings.na')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end md:w-80">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setSelectedBookingId(booking._id)}
                        className="gap-2 px-4"
                      >
                        <Eye className="size-4" />
                        {t('admin.bookings.viewDetail')}
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="px-4"
                      >
                        <Link
                          to="/admin/bookings/$bookingId"
                          params={{ bookingId: booking._id }}
                        >
                          {t('admin.bookings.openPage')}
                        </Link>
                      </Button>

                      {canManageBookings &&
                        booking.paymentStatus !== 'paid' &&
                        ['confirmed', 'checked_in'].includes(
                          booking.status,
                        ) && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="lg"
                            onClick={() => handleAcceptCashPayment(booking._id)}
                            className="gap-2 px-4 text-emerald-400"
                          >
                            <CircleDollarSign className="size-4" />
                            {t('admin.bookings.acceptCash')}
                          </Button>
                        )}

                      {canManageBookings &&
                        getAllowedBookingTransitions(booking.status).map(
                          (nextStatus) =>
                            nextStatus === 'cancelled' ? (
                              <Button
                                key={`${booking._id}-${nextStatus}`}
                                type="button"
                                variant="destructive"
                                size="lg"
                                onClick={() => handleCancel(booking._id)}
                                className="px-4"
                              >
                                {transitionLabel[nextStatus]}
                              </Button>
                            ) : (
                              <Button
                                key={`${booking._id}-${nextStatus}`}
                                type="button"
                                variant="secondary"
                                size="lg"
                                onClick={() =>
                                  handleStatusChange(booking._id, nextStatus)
                                }
                                className="px-4"
                              >
                                {transitionLabel[nextStatus]}
                              </Button>
                            ),
                        )}

                      {canManageBookings &&
                        profile.role !== 'room_admin' &&
                        ['confirmed', 'checked_in'].includes(
                          booking.status,
                        ) && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="lg"
                            onClick={() => setOutsourceBookingId(booking._id)}
                            className="gap-2 px-4 text-purple-400"
                          >
                            <Hotel className="size-4" />
                            {t('admin.bookings.outsource')}
                          </Button>
                        )}
                    </div>
                  </div>
                </div>
              </m.div>
            )
          })}
        </m.div>
      )}

      {!isBookingsLoading && (
        <LoadMoreButton
          status={bookingsPage.status}
          loadMore={bookingsPage.loadMore}
        />
      )}

      {/* Booking Detail Modal */}
      {selectedBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedBookingId(null)}
            aria-label={t('admin.bookings.closeDetails')}
          />
          <div className="admin-modal-panel relative w-full max-w-2xl">
            <div className="admin-modal-header">
              <div>
                <h3
                  className={`text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {t('admin.bookings.detailsTitle')}
                </h3>
                <p
                  className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  {t('admin.bookings.detailsSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'}`}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="admin-modal-body">
              {selectedBookingDetail === undefined ? (
                <div className="flex items-center justify-center py-12">
                  <div
                    className={`animate-spin rounded-full size-8 border-2 ${isDark ? 'border-violet-500/20 border-t-violet-500' : 'border-violet-500/20 border-t-violet-500'}`}
                  ></div>
                </div>
              ) : selectedBookingDetail === null ? (
                <div className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  {t('admin.bookings.notFound')}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                    <div className="admin-surface-muted p-4">
                      <p
                        className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {t('admin.bookings.guest')}
                      </p>
                      <p
                        className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                      >
                        {selectedBookingDetail.guestProfile?.name ||
                          selectedBookingDetail.booking.guestName ||
                          t('admin.bookings.na')}
                      </p>
                      <p
                        className={isDark ? 'text-slate-400' : 'text-slate-500'}
                      >
                        {selectedBookingDetail.guestProfile?.phone ||
                          t('admin.bookings.noPhone')}
                      </p>
                      <p
                        className={isDark ? 'text-slate-400' : 'text-slate-500'}
                      >
                        {selectedBookingDetail.guestProfile?.email ||
                          selectedBookingDetail.booking.guestEmail ||
                          t('admin.bookings.noEmail')}
                      </p>
                      {selectedBookingDetail.linkedUser && (
                        <p
                          className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                          {t('admin.bookings.linkedAccount')}:{' '}
                          {selectedBookingDetail.linkedUser.email}
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
                        {t('hotel.room')}{' '}
                        {selectedBookingDetail.room.roomNumber}
                      </p>
                      <p
                        className={`capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                      >
                        {selectedBookingDetail.room.type}
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
                        {selectedBookingDetail.hotel.name}
                      </p>
                      <p
                        className={isDark ? 'text-slate-400' : 'text-slate-500'}
                      >
                        {selectedBookingDetail.hotel.city}
                      </p>
                    </div>
                    <div className="admin-surface-muted p-4">
                      <p
                        className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {t('admin.bookings.stay')}
                      </p>
                      <p
                        className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                      >
                        {selectedBookingDetail.booking.checkIn} →{' '}
                        {selectedBookingDetail.booking.checkOut}
                      </p>
                      <p
                        className={isDark ? 'text-slate-400' : 'text-slate-500'}
                      >
                        $
                        {(
                          selectedBookingDetail.booking.totalPrice / 100
                        ).toFixed(2)}
                      </p>
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
                        {getPackageLabelOrDefault(
                          selectedBookingDetail.booking.packageType,
                          t,
                        )}
                      </p>
                      {selectedBookingDetail.booking.packageType && (
                        <p
                          className={
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }
                        >
                          {formatPackageAddOn(
                            selectedBookingDetail.booking.packageAddOn ?? 0,
                            t,
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedChapaPayment && (
                    <div className="admin-surface-muted p-4 text-sm">
                      <p
                        className={`mb-2 font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                      >
                        {t('admin.bookings.chapaPayment')}
                      </p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <p
                            className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          >
                            {t('admin.bookings.providerStatus')}
                          </p>
                          <p
                            className={
                              isDark ? 'text-slate-100' : 'text-slate-800'
                            }
                          >
                            {selectedChapaPayment.status.replaceAll('_', ' ')}
                          </p>
                        </div>
                        <div>
                          <p
                            className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          >
                            {t('admin.bookings.checkoutReference')}
                          </p>
                          <p
                            className={`break-all ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                          >
                            {selectedChapaPayment.chapaReference ||
                              selectedChapaPayment.txRef}
                          </p>
                        </div>
                        <div>
                          <p
                            className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          >
                            {t('admin.bookings.chargedAmount')}
                          </p>
                          <p
                            className={
                              isDark ? 'text-slate-100' : 'text-slate-800'
                            }
                          >
                            {formatEtbAmount(
                              selectedChapaPayment.chargedAmountMinor,
                            )}
                          </p>
                        </div>
                        <div>
                          <p
                            className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          >
                            {t('admin.bookings.paymentProvider')}
                          </p>
                          <p
                            className={
                              isDark ? 'text-slate-100' : 'text-slate-800'
                            }
                          >
                            Chapa
                            {selectedChapaPayment.paymentMethod
                              ? ` - ${selectedChapaPayment.paymentMethod}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="admin-modal-footer">
                    {profile.role !== 'room_admin' &&
                      canManageBooking(selectedBookingDetail.booking.hotelId) &&
                      ['confirmed', 'checked_in'].includes(
                        selectedBookingDetail.booking.status,
                      ) && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="lg"
                          onClick={() =>
                            setOutsourceBookingId(
                              selectedBookingDetail.booking._id,
                            )
                          }
                          className="gap-2 px-4 text-purple-400"
                        >
                          <Hotel className="size-4" />
                          {t('admin.bookings.outsource')}
                        </Button>
                      )}
                    <Link
                      to="/admin/bookings/$bookingId"
                      params={{ bookingId: selectedBookingId }}
                      className="admin-button-secondary px-4 py-2 text-sm"
                    >
                      {t('admin.bookings.openFullPage')}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {outsourceBookingId && outsourceBookingDetail && (
        <OutsourceModal
          bookingDetail={outsourceBookingDetail}
          onClose={() => setOutsourceBookingId(null)}
          onSuccess={() => setOutsourceBookingId(null)}
        />
      )}
    </m.div>
  )
}
