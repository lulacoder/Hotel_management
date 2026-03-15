import { motion } from 'motion/react'
import { Wallet } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { AnalyticsMetricCard } from './AnalyticsMetricCard'
import { AnalyticsStatusBreakdown } from './AnalyticsStatusBreakdown'
import { AnalyticsTrendChart } from './AnalyticsTrendChart'

interface Metric {
  key:
    | 'pendingPaymentBookings'
    | 'totalBookings'
    | 'arrivalsToday'
    | 'activeStays'
  value: number
  format: 'count'
}

interface Point {
  key: string
  label: string
  value: number
}

interface BreakdownItem {
  key: string
  count: number
}

interface Props {
  locale: Locale
  metrics: Metric[]
  bookingTrend: Point[] | undefined
  paymentStatuses: BreakdownItem[] | undefined
  bookingStatuses: BreakdownItem[] | undefined
  labels: Record<string, string>
  onMetricClick: (metricKey: string) => void
  onStatusClick: (statusKey: string, type: 'booking' | 'payment') => void
  emptyTitle: string
  emptyDescription: string
  bookingTrendTitle: string
  paymentBreakdownTitle: string
  bookingBreakdownTitle: string
}

const METRIC_ACCENTS_DARK: Record<Metric['key'], string> = {
  pendingPaymentBookings:
    'from-amber-500/15 to-orange-500/10 text-amber-300 border-amber-500/20',
  totalBookings:
    'from-blue-500/15 to-sky-500/10 text-blue-300 border-blue-500/20',
  arrivalsToday:
    'from-emerald-500/15 to-teal-500/10 text-emerald-300 border-emerald-500/20',
  activeStays:
    'from-violet-500/15 to-purple-500/10 text-violet-300 border-violet-500/20',
}

const METRIC_ACCENTS_LIGHT: Record<Metric['key'], string> = {
  pendingPaymentBookings:
    'from-amber-500/10 to-orange-500/5 text-amber-700 border-amber-300/50',
  totalBookings:
    'from-blue-500/10 to-sky-500/5 text-blue-700 border-blue-300/50',
  arrivalsToday:
    'from-emerald-500/10 to-teal-500/5 text-emerald-700 border-emerald-300/50',
  activeStays:
    'from-violet-500/10 to-purple-500/5 text-violet-700 border-violet-300/50',
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
    },
  },
}

export function CashierAnalyticsPanel({
  locale,
  metrics,
  bookingTrend,
  paymentStatuses,
  bookingStatuses,
  labels,
  onMetricClick,
  onStatusClick,
  emptyTitle,
  emptyDescription,
  bookingTrendTitle,
  paymentBreakdownTitle,
  bookingBreakdownTitle,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const accents = isDark ? METRIC_ACCENTS_DARK : METRIC_ACCENTS_LIGHT

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* ── Section header ── */}
      <motion.div
        variants={sectionVariants}
        className="flex items-center gap-3"
      >
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-inner ${
            isDark
              ? 'border-slate-700/60 bg-slate-800/60 shadow-black/20'
              : 'border-slate-200 bg-white shadow-slate-200/50'
          }`}
        >
          <Wallet
            size={16}
            className={isDark ? 'text-amber-400' : 'text-amber-600'}
          />
        </div>
        <div className="flex flex-col">
          <span
            className={`text-sm font-semibold tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
          >
            Cashier Dashboard
          </span>
          <span
            className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
          >
            Overview
          </span>
        </div>
        {/* Decorative trailing line */}
        <div
          aria-hidden
          className={`ml-2 h-px flex-1 bg-gradient-to-r ${
            isDark
              ? 'from-slate-700/50 via-slate-700/20 to-transparent'
              : 'from-slate-300/60 via-slate-200/30 to-transparent'
          }`}
        />
      </motion.div>

      {/* ── Metric cards ── */}
      <motion.div
        variants={sectionVariants}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((metric) => (
          <AnalyticsMetricCard
            key={metric.key}
            label={labels[metric.key] ?? metric.key}
            value={metric.value}
            format={metric.format}
            locale={locale}
            accentClassName={accents[metric.key]}
            onClick={() => onMetricClick(metric.key)}
          />
        ))}
      </motion.div>

      {/* ── Gradient divider ── */}
      <motion.div
        variants={sectionVariants}
        aria-hidden
        className="flex items-center gap-3"
      >
        <div
          className={`h-px flex-1 bg-gradient-to-r from-transparent to-transparent ${
            isDark ? 'via-slate-700/50' : 'via-slate-300/60'
          }`}
        />
        <div
          className={`h-1 w-1 rounded-full ${isDark ? 'bg-slate-700/60' : 'bg-slate-300/80'}`}
        />
        <div
          className={`h-px flex-1 bg-gradient-to-r from-transparent to-transparent ${
            isDark ? 'via-slate-700/50' : 'via-slate-300/60'
          }`}
        />
      </motion.div>

      {/* ── Charts & breakdowns ── */}
      <motion.div
        variants={sectionVariants}
        className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr]"
      >
        {/* Trend chart spans full width on lg, returns to 1.4fr on xl */}
        <div className="lg:col-span-2 xl:col-span-1">
          <AnalyticsTrendChart
            title={bookingTrendTitle}
            points={bookingTrend}
            locale={locale}
            format="count"
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
          />
        </div>

        <AnalyticsStatusBreakdown
          title={paymentBreakdownTitle}
          items={paymentStatuses}
          labels={labels}
          onItemClick={(item) => onStatusClick(item.key, 'payment')}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />

        <AnalyticsStatusBreakdown
          title={bookingBreakdownTitle}
          items={bookingStatuses}
          labels={labels}
          onItemClick={(item) => onStatusClick(item.key, 'booking')}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      </motion.div>
    </motion.div>
  )
}
