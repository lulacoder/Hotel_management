import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { Locale } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import {
  formatAnalyticsCount,
  formatAnalyticsCurrency,
} from '@/lib/adminAnalytics'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'

interface Point {
  key: string
  label: string
  value: number
}

interface Props {
  title: string
  points: Point[] | undefined
  locale: Locale
  format: 'currency' | 'count'
  onPointClick?: (point: Point) => void
  emptyTitle: string
  emptyDescription: string
}

function formatPointValue(
  value: number,
  format: 'currency' | 'count',
  locale: Locale,
) {
  return format === 'currency'
    ? formatAnalyticsCurrency(value, locale)
    : formatAnalyticsCount(value)
}

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */
function ChartTooltip({
  active,
  payload,
  format,
  locale,
  isDark,
}: {
  active?: boolean
  payload?: Array<{ payload: Point }>
  format: 'currency' | 'count'
  locale: Locale
  isDark: boolean
}) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload

  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur-md ${
        isDark
          ? 'border-slate-700/60 bg-slate-900/95 shadow-black/40'
          : 'border-slate-200 bg-white/95 shadow-slate-300/30'
      }`}
    >
      <p
        className={`text-[11px] font-medium tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        {point.label}
      </p>
      <p
        className={`mt-1 text-sm font-bold tabular-nums ${isDark ? 'text-slate-50' : 'text-slate-900'}`}
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {formatPointValue(point.value, format, locale)}
      </p>
    </div>
  )
}

export function AnalyticsTrendChart({
  title,
  points,
  locale,
  format,
  onPointClick,
  emptyTitle,
  emptyDescription,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = useCallback(
    (data: any) => {
      if (onPointClick && data?.activePayload?.[0]) {
        onPointClick(data.activePayload[0].payload as Point)
      }
    },
    [onPointClick],
  )

  if (!points || points.length === 0) {
    return (
      <AnalyticsEmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  const latestValue = points[points.length - 1]?.value ?? 0

  // Color scheme per format
  const isCurrency = format === 'currency'
  const strokeColor = isCurrency
    ? isDark
      ? '#38bdf8'
      : '#0284c7'
    : isDark
      ? '#818cf8'
      : '#4f46e5'
  const gradientFrom = isCurrency
    ? isDark
      ? 'rgba(56,189,248,0.35)'
      : 'rgba(2,132,199,0.18)'
    : isDark
      ? 'rgba(129,140,248,0.35)'
      : 'rgba(79,70,229,0.18)'
  const gradientTo = 'rgba(0,0,0,0)'

  const badgeClasses = isCurrency
    ? isDark
      ? 'border-sky-400/30 bg-sky-500/15 text-sky-300'
      : 'border-sky-500/30 bg-sky-50 text-sky-700'
    : isDark
      ? 'border-indigo-400/30 bg-indigo-500/15 text-indigo-300'
      : 'border-indigo-500/30 bg-indigo-50 text-indigo-700'

  const gridColor = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.2)'
  const axisTickColor = isDark ? '#64748b' : '#94a3b8'

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`analytics-card rounded-2xl border p-5 backdrop-blur-xl ${
        isDark
          ? 'border-slate-800/60 bg-slate-900/55'
          : 'border-slate-200/80 bg-white/80 shadow-sm'
      }`}
    >
      {/* Title bar */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3
          className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h3>
        <span
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold tabular-nums ${badgeClasses}`}
        >
          {formatPointValue(latestValue, format, locale)}
        </span>
      </div>

      {/* Recharts area chart */}
      <div className="mb-5 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            onClick={handleClick}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onMouseMove={(state: any) => {
              if (state?.activeTooltipIndex !== undefined) {
                setActiveIndex(Number(state.activeTooltipIndex))
              }
            }}
            onMouseLeave={() => setActiveIndex(null)}
            style={{ cursor: onPointClick ? 'pointer' : 'default' }}
          >
            <defs>
              <linearGradient
                id={`trend-grad-${format}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={gradientFrom} />
                <stop offset="100%" stopColor={gradientTo} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 6"
              vertical={false}
              stroke={gridColor}
            />

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 11,
                fill: axisTickColor,
                fontFamily: 'var(--font-body)',
              }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 11,
                fill: axisTickColor,
                fontFamily: 'var(--font-body)',
              }}
              tickFormatter={(v: number) =>
                format === 'currency'
                  ? `$${(v / 100).toLocaleString()}`
                  : v.toLocaleString()
              }
              width={52}
            />

            <Tooltip
              content={
                <ChartTooltip format={format} locale={locale} isDark={isDark} />
              }
              cursor={{
                stroke: isDark
                  ? 'rgba(148,163,184,0.15)'
                  : 'rgba(148,163,184,0.25)',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2.5}
              fill={`url(#trend-grad-${format})`}
              dot={(props: {
                cx?: number
                cy?: number
                index?: number
                payload?: Point
              }) => {
                const cx = props.cx ?? 0
                const cy = props.cy ?? 0
                const index = props.index ?? 0
                const isActive = activeIndex === index
                const isLast = index === points.length - 1
                const showDot = isActive || isLast

                if (!showDot) return <circle key={index} r={0} />

                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={isActive ? 5 : 4}
                    fill={isDark ? '#fff' : strokeColor}
                    stroke={strokeColor}
                    strokeWidth={2}
                    style={{
                      filter: isActive
                        ? `drop-shadow(0 0 6px ${strokeColor})`
                        : 'none',
                      transition: 'r 0.15s ease',
                    }}
                  />
                )
              }}
              activeDot={{
                r: 6,
                fill: isDark ? '#fff' : strokeColor,
                stroke: strokeColor,
                strokeWidth: 2,
                style: {
                  filter: `drop-shadow(0 0 8px ${strokeColor})`,
                },
              }}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Point value grid */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
        {points.map((point, index) => {
          const isLatest = index === points.length - 1
          const isEven = index % 2 === 0

          const cellClasses = isDark
            ? [
                'rounded-xl border p-3 transition-colors duration-150',
                isLatest
                  ? `border-slate-700/60 ${isCurrency ? 'bg-sky-950/30' : 'bg-indigo-950/30'}`
                  : isEven
                    ? 'border-slate-800/50 bg-slate-950/50'
                    : 'border-slate-800/50 bg-slate-900/30',
                onPointClick
                  ? 'hover:bg-slate-800/40 hover:border-slate-700/60'
                  : '',
              ].join(' ')
            : [
                'rounded-xl border p-3 transition-colors duration-150',
                isLatest
                  ? `border-slate-300/80 ${isCurrency ? 'bg-sky-50/80' : 'bg-indigo-50/80'}`
                  : isEven
                    ? 'border-slate-200/80 bg-slate-50/80'
                    : 'border-slate-200/80 bg-white/60',
                onPointClick
                  ? 'hover:bg-slate-100/80 hover:border-slate-300'
                  : '',
              ].join(' ')

          const cell = (
            <div className={cellClasses}>
              <p
                className={`text-[10px] uppercase tracking-[0.18em] ${
                  isLatest
                    ? isDark
                      ? 'text-slate-300'
                      : 'text-slate-600'
                    : isDark
                      ? 'text-slate-500'
                      : 'text-slate-400'
                }`}
              >
                {point.label}
              </p>
              <p
                className={`mt-2 text-sm font-semibold tabular-nums ${
                  isLatest
                    ? isDark
                      ? 'text-white'
                      : 'text-slate-900'
                    : isDark
                      ? 'text-slate-200'
                      : 'text-slate-700'
                }`}
              >
                {formatPointValue(point.value, format, locale)}
              </p>
            </div>
          )

          if (!onPointClick) {
            return <div key={point.key}>{cell}</div>
          }

          return (
            <button
              key={point.key}
              type="button"
              onClick={() => onPointClick(point)}
              className="text-left"
            >
              {cell}
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
