import { motion } from 'motion/react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts'
import { useTheme } from '@/lib/theme'
import { formatAnalyticsPercent } from '@/lib/adminAnalytics'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'

interface Point {
  key: string
  label: string
  occupiedRooms: number
  totalRooms: number
  occupancyRate: number
}

interface Props {
  title: string
  points: Point[] | undefined
  emptyTitle: string
  emptyDescription: string
}

/* -------------------------------------------------------------------------- */
/*  Semi-circular gauge (kept as SVG — unique visualization)                  */
/* -------------------------------------------------------------------------- */

const GAUGE_R = 80
const GAUGE_CX = 100
const GAUGE_CY = 100
const GAUGE_STROKE = 10
const GAUGE_CIRCUMFERENCE = Math.PI * GAUGE_R

function arcPath(cx: number, cy: number, r: number): string {
  const startX = cx - r
  const startY = cy
  const endX = cx + r
  const endY = cy
  return `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`
}

function gaugeGradientId(rate: number): string {
  if (rate < 0.5) return 'gauge-grad-low'
  if (rate < 0.8) return 'gauge-grad-mid'
  return 'gauge-grad-high'
}

function OccupancyGauge({ point, isDark }: { point: Point; isDark: boolean }) {
  const rate = Math.max(0, Math.min(1, point.occupancyRate))
  const filledLength = rate * GAUGE_CIRCUMFERENCE
  const percentText = Math.round(rate * 100)
  const gradId = gaugeGradientId(rate)

  const glowColor =
    rate < 0.5
      ? 'rgba(52,211,153,0.35)'
      : rate < 0.8
        ? 'rgba(251,191,36,0.30)'
        : 'rgba(251,113,133,0.30)'

  const trackColor = isDark ? 'rgba(51,65,85,0.45)' : 'rgba(203,213,225,0.6)'

  return (
    <div className="relative mx-auto w-full max-w-[220px]">
      <motion.svg
        viewBox="0 0 200 115"
        className="w-full overflow-visible"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        <defs>
          <linearGradient id="gauge-grad-low" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
          <linearGradient id="gauge-grad-mid" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="60%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient
            id="gauge-grad-high"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="45%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={arcPath(GAUGE_CX, GAUGE_CY, GAUGE_R)}
          fill="none"
          stroke={trackColor}
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
        />

        {/* Filled arc */}
        <motion.path
          d={arcPath(GAUGE_CX, GAUGE_CY, GAUGE_R)}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${GAUGE_CIRCUMFERENCE}`}
          initial={{ strokeDashoffset: GAUGE_CIRCUMFERENCE }}
          animate={{ strokeDashoffset: GAUGE_CIRCUMFERENCE - filledLength }}
          transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1], delay: 0.25 }}
          style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
        />

        {/* Tick marks */}
        {[0, 0.5, 1].map((t) => {
          const angle = Math.PI * (1 - t)
          const innerR = GAUGE_R - GAUGE_STROKE / 2 - 4
          const outerR = GAUGE_R - GAUGE_STROKE / 2 - 10
          const x1 = GAUGE_CX + innerR * Math.cos(angle)
          const y1 = GAUGE_CY - innerR * Math.sin(angle)
          const x2 = GAUGE_CX + outerR * Math.cos(angle)
          const y2 = GAUGE_CY - outerR * Math.sin(angle)
          return (
            <line
              key={t}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={
                isDark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.4)'
              }
              strokeWidth="1"
              strokeLinecap="round"
            />
          )
        })}
      </motion.svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <motion.p
          className={`text-5xl font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-900'}`}
          style={{
            fontFamily: 'var(--font-heading)',
            fontVariantNumeric: 'tabular-nums',
          }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
        >
          {percentText}
          <span
            className={`text-2xl ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          >
            %
          </span>
        </motion.p>
        <motion.p
          className={`mt-0.5 text-xs tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          {point.occupiedRooms}/{point.totalRooms} rooms
        </motion.p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Bar chart tooltip                                                          */
/* -------------------------------------------------------------------------- */
function OccupancyTooltip({
  active,
  payload,
  isDark,
}: {
  active?: boolean
  payload?: Array<{ payload: Point }>
  isDark: boolean
}) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload

  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur-md ${
        isDark
          ? 'border-slate-700/60 bg-slate-900/95 shadow-black/40'
          : 'border-slate-200 bg-white/95 shadow-slate-200/40'
      }`}
    >
      <p
        className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        {point.label}
      </p>
      <p
        className={`mt-1 text-sm font-bold tabular-nums ${isDark ? 'text-slate-50' : 'text-slate-900'}`}
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {formatAnalyticsPercent(point.occupancyRate)}
      </p>
      <p
        className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
      >
        {point.occupiedRooms}/{point.totalRooms} rooms
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Bar color by occupancy rate                                               */
/* -------------------------------------------------------------------------- */
function getBarColor(rate: number, isDark: boolean): string {
  if (rate >= 0.8) return isDark ? '#34d399' : '#059669'
  if (rate >= 0.5) return isDark ? '#fbbf24' : '#d97706'
  return isDark ? '#fb7185' : '#e11d48'
}

/* -------------------------------------------------------------------------- */
/*  Main card                                                                 */
/* -------------------------------------------------------------------------- */

export function AnalyticsOccupancyCard({
  title,
  points,
  emptyTitle,
  emptyDescription,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  if (!points || points.length === 0) {
    return (
      <AnalyticsEmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  const latest = points[points.length - 1]
  const barData = points.map((p) => ({
    ...p,
    // Convert to percentage for the bar chart display
    occupancyPercent: Math.round(p.occupancyRate * 100),
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="group/card relative"
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -inset-px rounded-2xl opacity-50 blur-xl transition-opacity duration-500 group-hover/card:opacity-80 ${
          isDark
            ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5'
            : 'bg-gradient-to-br from-emerald-400/8 to-teal-400/4'
        }`}
      />

      {/* Card surface */}
      <div
        className={`analytics-card relative isolate overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 group-hover/card:-translate-y-0.5 group-hover/card:shadow-lg ${
          isDark
            ? 'border-slate-800/60 bg-slate-900/55 group-hover/card:border-slate-700/60 group-hover/card:shadow-black/30'
            : 'border-slate-200/80 bg-white/80 shadow-sm group-hover/card:border-slate-300 group-hover/card:shadow-slate-200/50'
        }`}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3
              className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {title}
            </h3>
            <p
              className={`mt-0.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {latest.label}
            </p>
          </div>

          {/* Live badge */}
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              isDark
                ? 'border-emerald-500/20 bg-emerald-500/10'
                : 'border-emerald-400/30 bg-emerald-50'
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full duration-[2000ms] ${
                  isDark ? 'bg-emerald-400/60' : 'bg-emerald-500/50'
                }`}
              />
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'}`}
              />
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}
            >
              Live
            </span>
          </div>
        </div>

        {/* Hero gauge */}
        <div className="mb-5">
          <OccupancyGauge point={latest} isDark={isDark} />
        </div>

        {/* Recharts bar chart for historical data */}
        {barData.length > 1 && (
          <>
            <div
              aria-hidden
              className={`mb-4 h-px bg-gradient-to-r ${isDark ? 'from-transparent via-slate-700/50 to-transparent' : 'from-transparent via-slate-200 to-transparent'}`}
            />

            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 6"
                    vertical={false}
                    stroke={
                      isDark
                        ? 'rgba(148,163,184,0.06)'
                        : 'rgba(148,163,184,0.15)'
                    }
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 10,
                      fill: isDark ? '#64748b' : '#94a3b8',
                      fontFamily: 'var(--font-body)',
                    }}
                    dy={4}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 10,
                      fill: isDark ? '#64748b' : '#94a3b8',
                      fontFamily: 'var(--font-body)',
                    }}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    width={40}
                  />
                  <Tooltip
                    content={<OccupancyTooltip isDark={isDark} />}
                    cursor={{
                      fill: isDark
                        ? 'rgba(148,163,184,0.06)'
                        : 'rgba(148,163,184,0.1)',
                      radius: 4,
                    }}
                  />
                  <Bar
                    dataKey="occupancyPercent"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {barData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={getBarColor(entry.occupancyRate, isDark)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
