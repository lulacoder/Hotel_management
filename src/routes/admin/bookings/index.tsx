// Admin bookings list route with filtering and booking management actions.
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
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
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { motion } from 'motion/react'
import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '@/lib/theme'
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
import type { Id } from '../../../../convex/_generated/dataModel'

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

function BookingsPage() {
  const { user } = useUser()
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

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
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

  useEffect(() => {
    setStatusFilter(search.status)
  }, [search.status])

  useEffect(() => {
    setPaymentStatusFilter(search.paymentStatus)
  }, [search.paymentStatus])

  const bookings = useQuery(
    (api as any).bookings.getByHotel,
    user?.id
      ? {
          hotelId:
            selectedHotel !== 'all'
              ? (selectedHotel as Id<'hotels'>)
              : undefined,
        }
      : 'skip',
  ) as
    | Array<{
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
      }>
    | undefined

  const cancelBooking = useMutation(api.bookings.cancelBooking)
  const updateBookingStatus = useMutation(api.bookings.updateStatus)
  const acceptCashPayment = useMutation(api.bookings.acceptCashPayment)
  const selectedBookingDetail = useQuery(
    api.bookings.getEnriched,
    user?.id && selectedBookingId ? { bookingId: selectedBookingId } : 'skip',
  )
  const selectedChapaPayment = useQuery(
    api.chapaQueries.getPaymentForBooking,
    user?.id && selectedBookingId ? { bookingId: selectedBookingId } : 'skip',
  )
  const outsourceBookingDetail = useQuery(
    api.bookings.getEnriched,
    user?.id && outsourceBookingId ? { bookingId: outsourceBookingId } : 'skip',
  )

  const handleCancel = async (bookingId: Id<'bookings'>) => {
    if (!user?.id) return
    if (confirm(t('bookings.confirmCancel'))) {
      await cancelBooking({ bookingId })
    }
  }

  const handleStatusChange = async (
    bookingId: Id<'bookings'>,
    nextStatus: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled',
  ) => {
    if (!user?.id) return
    await updateBookingStatus({ bookingId, nextStatus })
  }

  const handleAcceptCashPayment = async (bookingId: Id<'bookings'>) => {
    if (!user?.id) return
    await acceptCashPayment({ bookingId })
  }

  const getAllowedTransitions = (status: string) => {
    // Keep transition rules consistent with backend booking workflow.
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
    return bookings?.filter((item) => {
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
    profile?.role === 'room_admin' ||
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

  const selectClass = `w-full px-4 py-3 rounded-xl text-sm font-medium border transition-all focus:outline-none ${
    isDark
      ? 'bg-slate-900/50 border-slate-800/50 text-slate-200 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20'
      : 'bg-white/80 border-slate-200/80 text-slate-700 shadow-sm focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20'
  }`

  return (
    <motion.div
      className="max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <h1
          className={`text-3xl font-semibold tracking-tight mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {t('admin.nav.bookings')}
        </h1>
        <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
          {t('admin.bookings.description')}
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col md:flex-row gap-4 mb-6"
      >
        {/* Hotel Select */}
        <div className="flex-1">
          <select
            value={selectedHotel}
            onChange={(e) => setSelectedHotel(e.target.value)}
            className={selectClass}
          >
            {profile?.role === 'room_admin' && (
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
            className={`${selectClass} md:w-48`}
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
            className={`${selectClass} md:w-48`}
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
      </motion.div>

      {/* Content */}
      {bookings === undefined ? (
        <div className="flex items-center justify-center py-20">
          <div
            className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-500/20 border-t-blue-500' : 'border-amber-500/20 border-t-amber-500'}`}
          ></div>
        </div>
      ) : filteredBookings?.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className={`border rounded-2xl p-12 text-center backdrop-blur-sm ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}
        >
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
          >
            <Calendar
              className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
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
        </motion.div>
      ) : (
        <motion.div className="space-y-4" variants={containerVariants}>
          {filteredBookings?.map((item) => {
            const booking = item.booking
            const status =
              statusConfig[booking.status as keyof typeof statusConfig] ??
              statusConfig.held
            const StatusIcon = status.icon
            const canManageBookings = canManageBooking(booking.hotelId)

            return (
              <motion.div key={booking._id} variants={itemVariants}>
                <div
                  className={`border rounded-xl p-5 backdrop-blur-sm transition-all duration-200 ${isDark ? 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50' : 'bg-white/80 border-slate-200/80 shadow-sm hover:border-slate-300/80 hover:shadow-md'}`}
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
                      <button
                        onClick={() => setSelectedBookingId(booking._id)}
                        className={`px-3 py-2 rounded-lg transition-all text-sm font-medium border inline-flex items-center gap-2 ${isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'}`}
                      >
                        <Eye className="w-4 h-4" />
                        {t('admin.bookings.viewDetail')}
                      </button>

                      <Link
                        to="/admin/bookings/$bookingId"
                        params={{ bookingId: booking._id }}
                        className={`px-3 py-2 rounded-lg transition-all text-sm font-medium border ${isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'}`}
                      >
                        {t('admin.bookings.openPage')}
                      </Link>

                      {canManageBookings &&
                        booking.paymentStatus !== 'paid' &&
                        ['confirmed', 'checked_in'].includes(
                          booking.status,
                        ) && (
                          <button
                            onClick={() => handleAcceptCashPayment(booking._id)}
                            className="px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-all text-sm font-medium border border-emerald-500/20 inline-flex items-center gap-2"
                          >
                            <CircleDollarSign className="w-4 h-4" />
                            {t('admin.bookings.acceptCash')}
                          </button>
                        )}

                      {canManageBookings &&
                        getAllowedTransitions(booking.status).map(
                          (nextStatus) =>
                            nextStatus === 'cancelled' ? (
                              <button
                                key={`${booking._id}-${nextStatus}`}
                                onClick={() => handleCancel(booking._id)}
                                className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-sm font-medium border border-red-500/20"
                              >
                                {transitionLabel[nextStatus]}
                              </button>
                            ) : (
                              <button
                                key={`${booking._id}-${nextStatus}`}
                                onClick={() =>
                                  handleStatusChange(booking._id, nextStatus)
                                }
                                className="px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all text-sm font-medium border border-blue-500/20"
                              >
                                {transitionLabel[nextStatus]}
                              </button>
                            ),
                        )}

                      {canManageBookings &&
                        profile?.role !== 'room_admin' &&
                        ['confirmed', 'checked_in'].includes(
                          booking.status,
                        ) && (
                          <button
                            onClick={() => setOutsourceBookingId(booking._id)}
                            className="px-3 py-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-all text-sm font-medium border border-purple-500/20 inline-flex items-center gap-2"
                          >
                            <Hotel className="w-4 h-4" />
                            {t('admin.bookings.outsource')}
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Booking Detail Modal */}
      {selectedBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedBookingId(null)}
            aria-label={t('admin.bookings.closeDetails')}
          />
          <div
            className={`relative w-full max-w-2xl border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-2xl'}`}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
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
                onClick={() => setSelectedBookingId(null)}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedBookingDetail === undefined ? (
              <div className="flex items-center justify-center py-12">
                <div
                  className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-500/20 border-t-blue-500' : 'border-amber-500/20 border-t-amber-500'}`}
                ></div>
              </div>
            ) : selectedBookingDetail === null ? (
              <div className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                {t('admin.bookings.notFound')}
              </div>
            ) : (
              <div className="space-y-4">
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
                      {selectedBookingDetail.guestProfile?.name ||
                        selectedBookingDetail.booking.guestName ||
                        t('admin.bookings.na')}
                    </p>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                      {selectedBookingDetail.guestProfile?.phone ||
                        t('admin.bookings.noPhone')}
                    </p>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                      {selectedBookingDetail.guestProfile?.email ||
                        selectedBookingDetail.booking.guestEmail ||
                        t('admin.bookings.noEmail')}
                    </p>
                    {selectedBookingDetail.linkedUser && (
                      <p
                        className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {t('admin.bookings.linkedAccount')}:{' '}
                        {selectedBookingDetail.linkedUser.email}
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
                      {t('hotel.room')} {selectedBookingDetail.room.roomNumber}
                    </p>
                    <p
                      className={`capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                      {selectedBookingDetail.room.type}
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
                      {selectedBookingDetail.hotel.name}
                    </p>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                      {selectedBookingDetail.hotel.city}
                    </p>
                  </div>
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
                      {selectedBookingDetail.booking.checkIn} →{' '}
                      {selectedBookingDetail.booking.checkOut}
                    </p>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                      $
                      {(selectedBookingDetail.booking.totalPrice / 100).toFixed(
                        2,
                      )}
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
                      {getPackageLabelOrDefault(
                        selectedBookingDetail.booking.packageType,
                        t,
                      )}
                    </p>
                    {selectedBookingDetail.booking.packageType && (
                      <p
                        className={isDark ? 'text-slate-400' : 'text-slate-500'}
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
                  <div
                    className={`border rounded-xl p-4 text-sm ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <p
                      className={`mb-2 font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                    >
                      {t('admin.bookings.chapaPayment')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p
                          className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                          {t('admin.bookings.providerStatus')}
                        </p>
                        <p
                          className={isDark ? 'text-slate-100' : 'text-slate-800'}
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
                          className={isDark ? 'text-slate-100' : 'text-slate-800'}
                        >
                          {formatEtbAmount(selectedChapaPayment.chargedAmountMinor)}
                        </p>
                      </div>
                      <div>
                        <p
                          className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                          {t('admin.bookings.paymentProvider')}
                        </p>
                        <p
                          className={isDark ? 'text-slate-100' : 'text-slate-800'}
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

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  {profile?.role !== 'room_admin' &&
                    canManageBooking(selectedBookingDetail.booking.hotelId) &&
                    ['confirmed', 'checked_in'].includes(
                      selectedBookingDetail.booking.status,
                    ) && (
                      <button
                        onClick={() =>
                          setOutsourceBookingId(
                            selectedBookingDetail.booking._id,
                          )
                        }
                        className="px-4 py-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-medium border border-purple-500/20 inline-flex items-center gap-2"
                      >
                        <Hotel className="w-4 h-4" />
                        {t('admin.bookings.outsource')}
                      </button>
                    )}
                  <Link
                    to="/admin/bookings/$bookingId"
                    params={{ bookingId: selectedBookingId }}
                    className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium border ${isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'}`}
                  >
                    {t('admin.bookings.openFullPage')}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {outsourceBookingId && outsourceBookingDetail && user?.id && (
        <OutsourceModal
          bookingDetail={outsourceBookingDetail}
          onClose={() => setOutsourceBookingId(null)}
          onSuccess={() => setOutsourceBookingId(null)}
        />
      )}
    </motion.div>
  )
}
