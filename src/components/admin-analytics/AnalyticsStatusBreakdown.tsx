import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useTheme } from '@/lib/theme'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'

interface Item {
  key: string
  count: number
}

interface Props {
  title: string
  items: Item[] | undefined
  labels: Record<string, string>
  onItemClick?: (item: Item) => void
  emptyTitle: string
  emptyDescription: string
}

/**
 * Palette — vibrant in dark, slightly muted in light for readability.
 */
const PALETTE_DARK = [
  '#22d3ee', // cyan
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#fbbf24', // amber
  '#34d399', // emerald
  '#fb7185', // rose
  '#38bdf8', // sky
  '#818cf8', // indigo
]
const PALETTE_LIGHT = [
  '#0891b2', // cyan-600
  '#2563eb', // blue-600
  '#7c3aed', // violet-600
  '#d97706', // amber-600
  '#059669', // emerald-600
  '#e11d48', // rose-600
  '#0284c7', // sky-600
  '#4f46e5', // indigo-600
]

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */
function DonutTooltip({
  active,
  payload,
  labels,
  total,
  isDark,
}: {
  active?: boolean
  payload?: Array<{ payload: Item & { fill: string } }>
  labels: Record<string, string>
  total: number
  isDark: boolean
}) {
  if (!active || !payload?.[0]) return null
  const item = payload[0].payload
  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0

  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur-md ${
        isDark
          ? 'border-slate-700/60 bg-slate-900/95 shadow-black/40'
          : 'border-slate-200 bg-white/95 shadow-slate-200/40'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: item.fill }}
        />
        <span
          className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
        >
          {labels[item.key] ?? item.key}
        </span>
      </div>
      <p
        className={`mt-1 text-sm font-bold tabular-nums ${isDark ? 'text-slate-50' : 'text-slate-900'}`}
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {item.count.toLocaleString()}{' '}
        <span
          className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
        >
          ({pct}%)
        </span>
      </p>
    </div>
  )
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.12 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
    },
  },
}

export function AnalyticsStatusBreakdown({
  title,
  items,
  labels,
  onItemClick,
  emptyTitle,
  emptyDescription,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const handlePieClick = useCallback(
    (_: unknown, index: number) => {
      if (onItemClick && items?.[index]) {
        onItemClick(items[index])
      }
    },
    [onItemClick, items],
  )

  if (!items || items.length === 0) {
    return (
      <AnalyticsEmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  const total = items.reduce((sum, item) => sum + item.count, 0)
  const palette = isDark ? PALETTE_DARK : PALETTE_LIGHT

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className={`analytics-card relative isolate overflow-hidden rounded-2xl border p-5 backdrop-blur-xl ${
        isDark
          ? 'border-slate-800/60 bg-slate-900/55'
          : 'border-slate-200/80 bg-white/80 shadow-sm'
      }`}
    >
      {/* Header: title + total count */}
      <div className="mb-4 flex items-center justify-between">
        <h3
          className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h3>
        <span
          className={`rounded-lg border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
            isDark
              ? 'border-slate-700/50 bg-slate-800/50 text-slate-300'
              : 'border-slate-200 bg-slate-100 text-slate-600'
          }`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {total.toLocaleString()}
        </span>
      </div>

      {/* Donut chart */}
      <div className="mx-auto mb-4 h-44 w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="count"
              nameKey="key"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={72}
              paddingAngle={2}
              strokeWidth={0}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={handlePieClick}
              style={{ cursor: onItemClick ? 'pointer' : 'default' }}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {items.map((item, index) => {
                const isActive = activeIndex === index
                return (
                  <Cell
                    key={item.key}
                    fill={palette[index % palette.length]}
                    stroke={isActive ? palette[index % palette.length] : 'none'}
                    strokeWidth={isActive ? 3 : 0}
                    style={{
                      filter: isActive
                        ? `drop-shadow(0 0 8px ${palette[index % palette.length]})`
                        : 'none',
                      transition: 'filter 0.2s ease, stroke-width 0.2s ease',
                      transform: isActive ? 'scale(1.04)' : 'scale(1)',
                      transformOrigin: 'center',
                    }}
                  />
                )
              })}
            </Pie>
            <Tooltip
              content={
                <DonutTooltip labels={labels} total={total} isDark={isDark} />
              }
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label inside donut */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ top: '45px', height: '176px' }}
        >
          <div className="text-center">
            <p
              className={`text-2xl font-bold tabular-nums ${isDark ? 'text-slate-50' : 'text-slate-900'}`}
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {total.toLocaleString()}
            </p>
            <p
              className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              Total
            </p>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div
        aria-hidden
        className={`mb-4 h-px bg-gradient-to-r ${isDark ? 'from-slate-700/60 via-slate-700/30 to-transparent' : 'from-slate-200 via-slate-200/60 to-transparent'}`}
      />

      {/* Legend list */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-2"
      >
        {items.map((item, index) => {
          const color = palette[index % palette.length]
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
          const isHovered = activeIndex === index

          const row = (
            <motion.div
              variants={itemVariants}
              className={`group/item flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200 ${
                isHovered
                  ? isDark
                    ? 'bg-slate-800/50'
                    : 'bg-slate-100/80'
                  : ''
              } ${
                onItemClick
                  ? isDark
                    ? 'cursor-pointer hover:bg-slate-800/40'
                    : 'cursor-pointer hover:bg-slate-50'
                  : ''
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {/* Color dot */}
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-transform duration-200"
                style={{
                  backgroundColor: color,
                  boxShadow: isHovered ? `0 0 8px ${color}` : 'none',
                  transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                }}
              />

              {/* Label */}
              <span
                className={`flex-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
              >
                {labels[item.key] ?? item.key}
              </span>

              {/* Percentage */}
              <span
                className={`text-xs font-medium tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
              >
                {pct}%
              </span>

              {/* Count */}
              <span
                className={`text-sm font-semibold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {item.count.toLocaleString()}
              </span>
            </motion.div>
          )

          if (!onItemClick) {
            return <div key={item.key}>{row}</div>
          }

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onItemClick(item)}
              className="w-full text-left"
            >
              {row}
            </button>
          )
        })}
      </motion.div>
    </motion.div>
  )
}
