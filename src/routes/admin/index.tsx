// Admin dashboard landing page with role-aware analytics and quick actions.
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import {
  Building2,
  Calendar,
  CircleAlert,
  Hotel,
  ArrowUpRight,
  BarChart3,
  TrendingUp,
  PieChart,
  Layers,
  Zap,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import {
  type AnalyticsWindow,
  type BookingStatusFilter,
  type PaymentStatusFilter,
  type RoomOperationalStatusFilter,
  normalizeAnalyticsWindow,
} from '@/lib/adminAnalytics'
import { AnalyticsMetricCard } from '@/components/admin-analytics/AnalyticsMetricCard'
import { AnalyticsOccupancyCard } from '@/components/admin-analytics/AnalyticsOccupancyCard'
import { AnalyticsStatusBreakdown } from '@/components/admin-analytics/AnalyticsStatusBreakdown'
import { AnalyticsTimeWindowTabs } from '@/components/admin-analytics/AnalyticsTimeWindowTabs'
import { AnalyticsTopHotelsTable } from '@/components/admin-analytics/AnalyticsTopHotelsTable'
import { AnalyticsTrendChart } from '@/components/admin-analytics/AnalyticsTrendChart'
import { CashierAnalyticsPanel } from '@/components/admin-analytics/CashierAnalyticsPanel'
import { AnalyticsEmptyState } from '@/components/admin-analytics/AnalyticsEmptyState'

export const Route = createFileRoute('/admin/')({
  validateSearch: (search: Record<string, unknown>) => ({
    window: normalizeAnalyticsWindow(search.window),
  }),
  // Register admin dashboard home route.
  component: AdminDashboard,
})

/* ------------------------------------------------------------------ */
/*  Stagger + fade variants                                            */
/* ------------------------------------------------------------------ */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut' as const },
  },
}

/* ------------------------------------------------------------------ */
/*  Section header component                                           */
/* ------------------------------------------------------------------ */
function SectionHeader({
  icon: Icon,
  label,
  isDark,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  isDark: boolean
}) {
  return (
    <motion.div variants={itemVariants} className="flex items-center gap-3">
      <div
        className={`w-1 h-5 rounded-full bg-gradient-to-b ${
          isDark ? 'from-amber-400 to-amber-600' : 'from-amber-500 to-amber-600'
        }`}
      />
      <Icon
        className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
      />
      <span
        className={`text-sm font-medium uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {label}
      </span>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Time-of-day greeting                                               */
/* ------------------------------------------------------------------ */
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ------------------------------------------------------------------ */
/*  Main dashboard                                                     */
/* ------------------------------------------------------------------ */
function AdminDashboard() {
  const { user } = useUser()
  const { t, locale } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const search = Route.useSearch()
  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )
  const assignedHotel = useQuery(
    api.hotels.get,
    hotelAssignment?.hotelId ? { hotelId: hotelAssignment.hotelId } : 'skip',
  )
  const window = search.window as AnalyticsWindow

  const summary = useQuery(
    api.analytics.getDashboardSummary,
    user?.id ? { window } : 'skip',
  )
  const bookingTrend = useQuery(
    api.analytics.getBookingTrend,
    user?.id ? { window } : 'skip',
  )
  const statusBreakdowns = useQuery(
    api.analytics.getStatusBreakdowns,
    user?.id ? { window } : 'skip',
  )
  const revenueTrend = useQuery(
    api.analytics.getRevenueTrend,
    user?.id && hotelAssignment?.role !== 'hotel_cashier' ? { window } : 'skip',
  )
  const occupancyTrend = useQuery(
    api.analytics.getOccupancyTrend,
    user?.id && hotelAssignment?.role !== 'hotel_cashier' ? { window } : 'skip',
  )
  const topHotels = useQuery(
    api.analytics.getTopHotels,
    user?.id && profile?.role === 'room_admin' ? { window } : 'skip',
  )

  const roleLabelByCode: Record<string, string> = {
    room_admin: t('admin.role.roomAdmin'),
    hotel_admin: t('admin.role.hotelAdmin'),
    hotel_cashier: t('admin.role.hotelCashier'),
  }

  const quickActions = [
    // Navigation shortcuts shown based on user permissions.
    {
      label: t('admin.nav.hotels'),
      description: t('admin.hotels.description'),
      icon: Hotel,
      to: '/admin/hotels',
    },
    {
      label: t('admin.nav.rooms'),
      description: t('admin.rooms.description'),
      icon: Building2,
      to: '/admin/rooms',
    },
    {
      label: t('admin.nav.bookings'),
      description: t('admin.bookings.description'),
      icon: Calendar,
      to: '/admin/bookings',
    },
  ].filter((action) => {
    if (profile?.role === 'room_admin') {
      return true
    }

    if (hotelAssignment?.role === 'hotel_cashier') {
      return action.to === '/admin/bookings'
    }

    return true
  })

  const metricLabels: Record<string, string> = {
    collectedRevenue: t('admin.analytics.collectedRevenue' as never),
    confirmedRevenuePipeline: t('admin.analytics.confirmedPipeline' as never),
    totalBookings: t('admin.analytics.totalBookings' as never),
    activeStays: t('admin.analytics.activeStays' as never),
    occupancyRate: t('admin.analytics.occupancy' as never),
    pendingPaymentBookings: t(
      'admin.analytics.pendingPaymentBookings' as never,
    ),
    arrivalsToday: t('admin.analytics.arrivalsToday' as never),
    held: t('booking.status.held'),
    pending_payment: t('booking.status.pendingPayment'),
    confirmed: t('booking.status.confirmed'),
    checked_in: t('booking.status.checkedIn'),
    checked_out: t('booking.status.checkedOut'),
    cancelled: t('booking.status.cancelled'),
    expired: t('booking.status.expired'),
    outsourced: t('booking.status.outsourced'),
    pending: t('admin.bookings.pending'),
    paid: t('admin.analytics.payment.paid' as never),
    failed: t('admin.analytics.payment.failed' as never),
    refunded: t('admin.analytics.payment.refunded' as never),
    unpaid_unknown: t('admin.analytics.payment.unknown' as never),
    available: t('admin.hotels.status.available'),
    maintenance: t('admin.hotels.status.maintenance'),
    cleaning: t('admin.hotels.status.cleaning'),
    out_of_order: t('admin.hotels.status.outOfOrder'),
  }

  const handleWindowChange = (nextWindow: AnalyticsWindow) => {
    navigate({ to: '/admin', search: { window: nextWindow } })
  }

  const navigateToBookings = (nextSearch: {
    status?: string
    paymentStatus?: string
  }) => {
    navigate({
      to: '/admin/bookings',
      search: {
        status: (nextSearch.status ?? 'all') as BookingStatusFilter,
        paymentStatus: (nextSearch.paymentStatus ??
          'all') as PaymentStatusFilter,
        window,
      },
    })
  }

  const navigateToRooms = (operationalStatus: string) => {
    navigate({
      to: '/admin/rooms',
      search: {
        operationalStatus: operationalStatus as RoomOperationalStatusFilter,
        window,
      },
    })
  }

  const isCashier = hotelAssignment?.role === 'hotel_cashier'
  const revenueMetric = summary?.primaryKpis.find(
    (metric) => metric.key === 'collectedRevenue',
  )
  const operationsMetrics = summary?.primaryKpis.filter(
    (metric) => metric.key !== 'collectedRevenue',
  )

  /* -------------------------------------------------------------- */
  /*  Welcome header                                                 */
  /* -------------------------------------------------------------- */
  const summaryHeader = (
    <motion.div
      variants={itemVariants}
      className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <div>
        <p
          className={`mb-1 text-sm font-medium tracking-wide ${isDark ? 'text-amber-400/80' : 'text-amber-600/90'}`}
        >
          {getGreeting()}
        </p>
        <h1
          className={`text-4xl font-bold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {t('admin.welcomeBack', {
            name: user?.firstName || t('admin.defaultUserName'),
          })}
        </h1>
        <p
          className={`mt-2 max-w-2xl ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
        >
          {t('admin.overview')}
        </p>
      </div>
      <AnalyticsTimeWindowTabs value={window} onChange={handleWindowChange} />
    </motion.div>
  )

  return (
    <motion.div
      className="mx-auto max-w-7xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {summaryHeader}

      {/* Hotel assignment banner */}
      {hotelAssignment && assignedHotel && profile?.role !== 'room_admin' && (
        <motion.div
          variants={itemVariants}
          className={`relative mb-10 overflow-hidden rounded-2xl border backdrop-blur-sm ${
            isDark
              ? 'border-slate-800/60 bg-slate-900/60'
              : 'border-slate-200/80 bg-white/80 shadow-sm'
          }`}
        >
          {/* Left gradient accent bar */}
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600" />
          <div className="flex items-start gap-4 py-5 pl-6 pr-6">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                isDark ? 'bg-blue-500/10' : 'bg-blue-50'
              }`}
            >
              <Building2
                className={`h-5 w-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
              />
            </div>
            <div>
              <h3
                className={`text-sm font-semibold uppercase tracking-wide ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
              >
                {t('admin.users.hotelAssignment')}
              </h3>
              <p
                className={`mt-0.5 text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
              >
                {t('admin.dashboard.assignmentSummary', {
                  hotelName: assignedHotel.name,
                  city: assignedHotel.city,
                  role:
                    roleLabelByCode[hotelAssignment.role] ||
                    hotelAssignment.role,
                })}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {summary === undefined ? (
        <AnalyticsEmptyState
          title={t('admin.analytics.loading' as never)}
          description={t('admin.analytics.loadingDescription' as never)}
        />
      ) : isCashier ? (
        <motion.div variants={itemVariants} className="mb-8">
          <CashierAnalyticsPanel
            locale={locale}
            metrics={
              (summary?.primaryKpis ?? []).filter(
                (metric) => metric.format === 'count',
              ) as Array<{
                key:
                  | 'pendingPaymentBookings'
                  | 'totalBookings'
                  | 'arrivalsToday'
                  | 'activeStays'
                value: number
                format: 'count'
              }>
            }
            bookingTrend={bookingTrend?.points}
            paymentStatuses={statusBreakdowns?.paymentStatuses}
            bookingStatuses={statusBreakdowns?.bookingStatuses}
            labels={metricLabels}
            onMetricClick={(metricKey) => {
              if (metricKey === 'pendingPaymentBookings') {
                navigateToBookings({ paymentStatus: 'pending' })
                return
              }

              if (metricKey === 'arrivalsToday') {
                navigateToBookings({ status: 'confirmed' })
                return
              }

              navigateToBookings({})
            }}
            onStatusClick={(statusKey, type) => {
              if (type === 'payment') {
                navigateToBookings({ paymentStatus: statusKey })
                return
              }

              navigateToBookings({ status: statusKey })
            }}
            emptyTitle={t('admin.analytics.noData' as never)}
            emptyDescription={t('admin.analytics.noDataDescription' as never)}
            bookingTrendTitle={t('admin.analytics.bookingTrend' as never)}
            paymentBreakdownTitle={t(
              'admin.analytics.paymentBreakdown' as never,
            )}
            bookingBreakdownTitle={t(
              'admin.analytics.bookingBreakdown' as never,
            )}
          />
        </motion.div>
      ) : (
        <div className="mb-10 space-y-8">
          {/* --- Key Metrics --- */}
          <SectionHeader icon={BarChart3} label="Key Metrics" isDark={isDark} />
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            {revenueMetric && (
              <motion.div variants={itemVariants}>
                <AnalyticsMetricCard
                  label={metricLabels[revenueMetric.key]}
                  value={revenueMetric.value}
                  format={revenueMetric.format}
                  locale={locale}
                  secondaryLabel={
                    revenueMetric.secondaryKey
                      ? metricLabels[revenueMetric.secondaryKey]
                      : undefined
                  }
                  secondaryValue={revenueMetric.secondaryValue}
                  accentClassName={
                    isDark
                      ? 'from-violet-500/15 to-fuchsia-500/10 text-violet-300 border-violet-500/20'
                      : 'from-violet-500/10 to-fuchsia-500/5 text-violet-700 border-violet-300/50'
                  }
                />
              </motion.div>
            )}
            {operationsMetrics?.map((metric) => (
              <motion.div key={metric.key} variants={itemVariants}>
                <AnalyticsMetricCard
                  label={metricLabels[metric.key]}
                  value={metric.value}
                  format={metric.format}
                  locale={locale}
                  onClick={() => {
                    if (
                      metric.key === 'totalBookings' ||
                      metric.key === 'activeStays'
                    ) {
                      navigateToBookings({})
                      return
                    }

                    if (metric.key === 'occupancyRate') {
                      navigateToRooms('available')
                    }
                  }}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* --- Trends & Activity --- */}
          <SectionHeader
            icon={TrendingUp}
            label="Trends & Activity"
            isDark={isDark}
          />
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 gap-6 xl:grid-cols-2"
          >
            <motion.div variants={itemVariants}>
              <AnalyticsTrendChart
                title={t('admin.analytics.bookingTrend' as never)}
                points={bookingTrend?.points}
                locale={locale}
                format="count"
                onPointClick={() => navigateToBookings({})}
                emptyTitle={t('admin.analytics.noData' as never)}
                emptyDescription={t(
                  'admin.analytics.noDataDescription' as never,
                )}
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <AnalyticsTrendChart
                title={t('admin.analytics.revenueTrend' as never)}
                points={revenueTrend?.points}
                locale={locale}
                format="currency"
                emptyTitle={t('admin.analytics.noData' as never)}
                emptyDescription={t(
                  'admin.analytics.noDataDescription' as never,
                )}
              />
            </motion.div>
          </motion.div>

          {/* --- Status Overview --- */}
          <SectionHeader
            icon={PieChart}
            label="Status Overview"
            isDark={isDark}
          />
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 gap-6 xl:grid-cols-3"
          >
            <motion.div variants={itemVariants}>
              <AnalyticsStatusBreakdown
                title={t('admin.analytics.bookingBreakdown' as never)}
                items={statusBreakdowns?.bookingStatuses}
                labels={metricLabels}
                onItemClick={(item) => navigateToBookings({ status: item.key })}
                emptyTitle={t('admin.analytics.noData' as never)}
                emptyDescription={t(
                  'admin.analytics.noDataDescription' as never,
                )}
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <AnalyticsStatusBreakdown
                title={t('admin.analytics.paymentBreakdown' as never)}
                items={statusBreakdowns?.paymentStatuses}
                labels={metricLabels}
                onItemClick={(item) =>
                  navigateToBookings({ paymentStatus: item.key })
                }
                emptyTitle={t('admin.analytics.noData' as never)}
                emptyDescription={t(
                  'admin.analytics.noDataDescription' as never,
                )}
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <AnalyticsStatusBreakdown
                title={t('admin.analytics.roomBreakdown' as never)}
                items={statusBreakdowns?.roomStatuses}
                labels={metricLabels}
                onItemClick={(item) => navigateToRooms(item.key)}
                emptyTitle={t('admin.analytics.noData' as never)}
                emptyDescription={t(
                  'admin.analytics.noDataDescription' as never,
                )}
              />
            </motion.div>
          </motion.div>

          {/* --- Property Performance --- */}
          <SectionHeader
            icon={Layers}
            label="Property Performance"
            isDark={isDark}
          />
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]"
          >
            <motion.div variants={itemVariants}>
              <AnalyticsOccupancyCard
                title={t('admin.analytics.occupancyTrend' as never)}
                points={occupancyTrend?.points}
                emptyTitle={t('admin.analytics.noData' as never)}
                emptyDescription={t(
                  'admin.analytics.noDataDescription' as never,
                )}
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              {profile?.role === 'room_admin' ? (
                <AnalyticsTopHotelsTable
                  rows={topHotels?.hotels?.map((hotel) => ({
                    ...hotel,
                    hotelId: String(hotel.hotelId),
                  }))}
                  locale={locale}
                  onHotelClick={(hotelId) => {
                    navigate({
                      to: '/admin/hotels/$hotelId',
                      params: { hotelId: hotelId as any },
                      search: { operationalStatus: 'all', window: '30d' },
                    })
                  }}
                  title={t('admin.analytics.topHotels' as never)}
                  emptyTitle={t('admin.analytics.noData' as never)}
                  emptyDescription={t(
                    'admin.analytics.noDataDescription' as never,
                  )}
                  hotelLabel={t('admin.analytics.columns.hotel' as never)}
                  revenueLabel={t('admin.analytics.columns.revenue' as never)}
                  bookingsLabel={t('admin.analytics.columns.bookings' as never)}
                  occupancyLabel={t(
                    'admin.analytics.columns.occupancy' as never,
                  )}
                />
              ) : (
                <AnalyticsEmptyState
                  title={t('admin.analytics.hotelScopeOnly' as never)}
                  description={t(
                    'admin.analytics.hotelScopeOnlyDescription' as never,
                  )}
                />
              )}
            </motion.div>
          </motion.div>
        </div>
      )}

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="mb-10">
        <SectionHeader icon={Zap} label="Quick Actions" isDark={isDark} />
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {quickActions.map((action, i) => (
            <motion.div key={action.label} variants={itemVariants} custom={i}>
              <Link
                to={action.to}
                className={`group relative block overflow-hidden rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 ${
                  isDark
                    ? 'border-slate-800/50 bg-slate-900/50 hover:border-amber-500/30 hover:bg-slate-800/40 hover:shadow-[0_0_24px_-6px_rgba(245,158,11,0.15)]'
                    : 'border-slate-200/80 bg-white/80 shadow-sm hover:border-amber-500/40 hover:bg-amber-50/30 hover:shadow-lg hover:shadow-amber-500/10'
                }`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br transition-all duration-300 ${
                      isDark
                        ? 'from-slate-700/80 to-slate-800/80 group-hover:from-amber-500/20 group-hover:to-amber-600/10'
                        : 'from-slate-100 to-slate-200/80 group-hover:from-amber-100 group-hover:to-amber-50'
                    }`}
                  >
                    <action.icon
                      className={`h-6 w-6 transition-colors duration-300 ${
                        isDark
                          ? 'text-slate-400 group-hover:text-amber-400'
                          : 'text-slate-500 group-hover:text-amber-600'
                      }`}
                    />
                  </div>
                  <ArrowUpRight
                    className={`h-5 w-5 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                      isDark
                        ? 'text-slate-700 group-hover:text-amber-400'
                        : 'text-slate-300 group-hover:text-amber-500'
                    }`}
                  />
                </div>
                <h3
                  className={`font-semibold transition-colors duration-300 ${
                    isDark
                      ? 'text-slate-200 group-hover:text-amber-300'
                      : 'text-slate-800 group-hover:text-amber-700'
                  }`}
                >
                  {action.label}
                </h3>
                <p
                  className={`mt-1 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {action.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        variants={itemVariants}
        className={`relative overflow-hidden rounded-2xl border backdrop-blur-sm ${
          isDark
            ? 'border-slate-800/60 bg-slate-900/50'
            : 'border-slate-200/80 bg-white/80 shadow-sm'
        }`}
      >
        {/* Left gradient accent bar */}
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600" />
        <div className="flex items-start gap-4 py-4 pl-6 pr-6">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
              isDark ? 'bg-blue-500/10' : 'bg-blue-50'
            }`}
          >
            <CircleAlert
              className={`h-5 w-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
            />
          </div>
          <div>
            <h3
              className={`text-sm font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
            >
              {t('admin.dashboard.roleAccessTitle')}
            </h3>
            <p
              className={`mt-0.5 text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              {t('admin.dashboard.roleAccessDescription', {
                email: profile?.email || t('admin.bookings.na'),
                role:
                  roleLabelByCode[profile?.role || ''] ||
                  profile?.role ||
                  t('admin.role.user'),
              })}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
