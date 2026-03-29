import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import {
  formatAnalyticsCount,
  formatAnalyticsCurrency,
  formatAnalyticsPercent,
} from '@/lib/adminAnalytics'

interface Props {
  label: string
  value: number
  format: 'currency' | 'count' | 'percent'
  locale: Locale
  accentClassName?: string
  secondaryLabel?: string
  secondaryValue?: number
  onClick?: () => void
}

function formatMetricValue(
  value: number,
  format: 'currency' | 'count' | 'percent',
  locale: Locale,
) {
  if (format === 'currency') {
    return formatAnalyticsCurrency(value, locale)
  }

  if (format === 'percent') {
    return formatAnalyticsPercent(value)
  }

  return formatAnalyticsCount(value)
}

export function AnalyticsMetricCard({
  label,
  value,
  format,
  locale,
  accentClassName = 'from-violet-500/15 to-purple-500/10 text-violet-300 border-violet-500/20',
  secondaryLabel,
  secondaryValue,
  onClick,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className="group/card relative"
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br opacity-40 blur-xl transition-opacity duration-500 group-hover/card:opacity-70 ${accentClassName}`}
      />

      {/* Card surface */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 group-hover/card:-translate-y-0.5 group-hover/card:shadow-lg ${
          isDark
            ? 'border-slate-800/60 bg-slate-900/55 group-hover/card:border-slate-600/60 group-hover/card:bg-slate-900/80 group-hover/card:shadow-black/30'
            : 'border-slate-200/80 bg-white/80 shadow-sm group-hover/card:border-slate-300 group-hover/card:bg-white/90 group-hover/card:shadow-slate-200/50'
        }`}
      >
        {/* Noise-texture overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: '128px 128px',
          }}
        />

        {/* Decorative corner */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -right-1 -top-1 h-16 w-16 rounded-full bg-gradient-to-br opacity-50 blur-xl transition-opacity duration-500 group-hover/card:opacity-80 ${accentClassName}`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-gradient-to-br ${accentClassName}`}
          style={{ filter: 'brightness(1.8)' }}
        />

        {/* Label badge */}
        <div className="mb-4 flex items-center justify-between">
          <div className="relative overflow-hidden">
            <div
              className={`relative inline-flex rounded-xl border bg-gradient-to-r px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                isDark
                  ? accentClassName
                  : accentClassName
                      .replace('/15', '/10')
                      .replace('/10', '/8')
                      .replace('text-violet-300', 'text-violet-700')
                      .replace('text-purple-300', 'text-purple-700')
                      .replace('text-violet-300', 'text-violet-700')
                      .replace('text-indigo-300', 'text-indigo-700')
                      .replace('text-amber-300', 'text-amber-700')
                      .replace('text-emerald-300', 'text-emerald-700')
              }`}
            >
              {label}
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
              />
            </div>
          </div>

          {onClick && (
            <ArrowRight
              size={14}
              className={`transition-all duration-300 group-hover/card:translate-x-0.5 ${
                isDark
                  ? 'text-slate-600 group-hover/card:text-slate-400'
                  : 'text-slate-300 group-hover/card:text-slate-500'
              }`}
            />
          )}
        </div>

        {/* Values */}
        <div>
          <p
            className={`text-4xl font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-900'}`}
            style={{
              fontFamily: 'var(--font-heading)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMetricValue(value, format, locale)}
          </p>

          {secondaryLabel && secondaryValue !== undefined && (
            <>
              <div
                aria-hidden
                className={`my-3 h-px bg-gradient-to-r ${
                  isDark
                    ? 'from-slate-700/60 via-slate-700/30 to-transparent'
                    : 'from-slate-200 via-slate-200/60 to-transparent'
                }`}
              />
              <p
                className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              >
                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                  {secondaryLabel}:{' '}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatMetricValue(secondaryValue, format, locale)}
                </span>
              </p>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )

  if (!onClick) {
    return content
  }

  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      {content}
    </button>
  )
}
