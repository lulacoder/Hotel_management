import { motion } from 'motion/react'
import { Building2, DollarSign, Calendar, BarChart3 } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import {
  formatAnalyticsCurrency,
  formatAnalyticsPercent,
} from '@/lib/adminAnalytics'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'

interface Row {
  hotelId: string
  hotelName: string
  collectedRevenue: number
  bookingCount: number
  occupancyRate: number
}

interface Props {
  rows: Row[] | undefined
  locale: Locale
  onHotelClick: (hotelId: string) => void
  title: string
  emptyTitle: string
  emptyDescription: string
  hotelLabel: string
  revenueLabel: string
  bookingsLabel: string
  occupancyLabel: string
}

const RANK_STYLES = [
  {
    gradient: 'from-amber-400 to-yellow-500',
    glow: 'shadow-[0_0_10px_rgba(251,191,36,0.3)]',
    revenue: 'text-amber-200',
    revenueLt: 'text-amber-700',
  },
  {
    gradient: 'from-slate-300 to-slate-400',
    glow: '',
    revenue: 'text-slate-200',
    revenueLt: 'text-slate-700',
  },
  {
    gradient: 'from-amber-600 to-orange-500',
    glow: '',
    revenue: 'text-orange-200',
    revenueLt: 'text-orange-700',
  },
] as const

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const style = RANK_STYLES[rank - 1]
    return (
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${style.gradient} text-xs font-bold text-slate-950 ${style.glow}`}
      >
        {rank}
      </span>
    )
  }

  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-800/60 text-xs font-semibold text-slate-400">
      {rank}
    </span>
  )
}

function OccupancyBar({ rate, isDark }: { rate: number; isDark: boolean }) {
  const percent = Math.min(rate * 100, 100)
  const rankColor =
    percent >= 80
      ? isDark
        ? 'from-emerald-400 to-teal-300'
        : 'from-emerald-500 to-teal-400'
      : percent >= 50
        ? isDark
          ? 'from-amber-400 to-yellow-300'
          : 'from-amber-500 to-yellow-400'
        : isDark
          ? 'from-rose-400 to-orange-300'
          : 'from-rose-500 to-orange-400'

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`text-sm tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
      >
        {formatAnalyticsPercent(rate)}
      </span>
      <div
        className={`h-1.5 w-16 overflow-hidden rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200'}`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
          className={`h-full rounded-full bg-gradient-to-r ${rankColor}`}
        />
      </div>
    </div>
  )
}

function ColumnHeader({
  icon: Icon,
  label,
  align = 'left',
  isDark,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  align?: 'left' | 'right'
  isDark: boolean
}) {
  return (
    <th
      className={`pb-3.5 text-xs uppercase tracking-[0.18em] ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
    >
      <div
        className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}
      >
        <Icon
          size={13}
          className={isDark ? 'text-slate-600' : 'text-slate-400'}
        />
        <span>{label}</span>
      </div>
    </th>
  )
}

export function AnalyticsTopHotelsTable({
  rows,
  locale,
  onHotelClick,
  title,
  emptyTitle,
  emptyDescription,
  hotelLabel,
  revenueLabel,
  bookingsLabel,
  occupancyLabel,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  if (!rows || rows.length === 0) {
    return (
      <AnalyticsEmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className="group/card relative"
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -inset-px rounded-2xl opacity-40 blur-xl transition-opacity duration-500 group-hover/card:opacity-60 ${
          isDark
            ? 'bg-gradient-to-br from-slate-500/10 to-slate-600/5'
            : 'bg-gradient-to-br from-slate-300/10 to-slate-400/5'
        }`}
      />

      {/* Card */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 group-hover/card:border-slate-700/60 ${
          isDark
            ? 'border-slate-800/60 bg-slate-900/55 group-hover/card:bg-slate-900/70'
            : 'border-slate-200/80 bg-white/80 shadow-sm group-hover/card:border-slate-300 group-hover/card:bg-white/90'
        }`}
      >
        {/* Noise texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: '128px 128px',
          }}
        />

        {/* Title */}
        <h3
          className={`mb-5 text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h3>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr
                className={`border-b ${isDark ? 'border-slate-800/70' : 'border-slate-200'}`}
              >
                <ColumnHeader
                  icon={Building2}
                  label={hotelLabel}
                  isDark={isDark}
                />
                <ColumnHeader
                  icon={DollarSign}
                  label={revenueLabel}
                  isDark={isDark}
                />
                <ColumnHeader
                  icon={Calendar}
                  label={bookingsLabel}
                  isDark={isDark}
                />
                <ColumnHeader
                  icon={BarChart3}
                  label={occupancyLabel}
                  align="right"
                  isDark={isDark}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const rank = index + 1
                const rankStyle = rank <= 3 ? RANK_STYLES[rank - 1] : null
                const revenueColor = rankStyle
                  ? isDark
                    ? rankStyle.revenue
                    : rankStyle.revenueLt
                  : isDark
                    ? 'text-slate-200'
                    : 'text-slate-700'

                return (
                  <motion.tr
                    key={row.hotelId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: index * 0.06,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    className={`group/row border-b transition-colors duration-200 last:border-b-0 ${
                      isDark
                        ? 'border-slate-800/40 hover:bg-slate-800/20'
                        : 'border-slate-100 hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Hotel name */}
                    <td className="relative py-4 pr-4">
                      <div
                        aria-hidden
                        className={`absolute left-0 top-2 h-[calc(100%-16px)] w-0.5 rounded-full bg-gradient-to-b ${
                          rankStyle
                            ? rankStyle.gradient
                            : 'from-slate-500 to-slate-600'
                        } opacity-0 transition-opacity duration-200 group-hover/row:opacity-100`}
                      />
                      <button
                        type="button"
                        onClick={() => onHotelClick(row.hotelId)}
                        className="group/btn text-left"
                      >
                        <div className="flex items-center gap-3 pl-2">
                          <RankBadge rank={rank} />
                          <span
                            className={`relative font-medium transition-colors duration-200 ${
                              isDark
                                ? 'text-slate-100 group-hover/btn:text-white'
                                : 'text-slate-800 group-hover/btn:text-slate-950'
                            }`}
                          >
                            {row.hotelName}
                            <span
                              aria-hidden
                              className={`absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r transition-all duration-300 group-hover/btn:w-full ${
                                isDark
                                  ? 'from-slate-400 to-transparent'
                                  : 'from-slate-600 to-transparent'
                              }`}
                            />
                          </span>
                        </div>
                      </button>
                    </td>

                    {/* Revenue */}
                    <td
                      className={`py-4 pr-4 font-semibold tabular-nums ${revenueColor}`}
                    >
                      {formatAnalyticsCurrency(row.collectedRevenue, locale)}
                    </td>

                    {/* Bookings */}
                    <td
                      className={`py-4 pr-4 tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                    >
                      {row.bookingCount}
                    </td>

                    {/* Occupancy */}
                    <td className="py-4">
                      <div className="flex justify-end">
                        <OccupancyBar
                          rate={row.occupancyRate}
                          isDark={isDark}
                        />
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}
