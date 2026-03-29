import { motion } from 'motion/react'
import { useTheme } from '@/lib/theme'

interface Props {
  title: string
  description: string
}

export function AnalyticsEmptyState({ title, description }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className={`relative isolate overflow-hidden rounded-2xl border px-8 py-14 text-center ${
        isDark
          ? 'border-slate-800/60 shadow-[0_0_24px_-6px_rgba(100,140,200,0.06)]'
          : 'border-slate-200/80 bg-white/60 shadow-sm'
      }`}
    >
      {/* Radial gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(56,100,160,0.08) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(56,100,160,0.05) 0%, transparent 70%)',
        }}
      />

      {/* Background tint */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 -z-10 ${isDark ? 'bg-slate-900/50' : 'bg-white/30'}`}
      />

      {/* Decorative bar-chart illustration */}
      <motion.svg
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
        viewBox="0 0 72 48"
        fill="none"
        className="mx-auto mb-6 h-12 w-18"
        aria-hidden
      >
        <line
          x1="8"
          y1="44"
          x2="64"
          y2="44"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={isDark ? 'text-slate-700/80' : 'text-slate-300'}
        />
        <rect
          x="16"
          y="28"
          width="8"
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          className={isDark ? 'text-slate-700' : 'text-slate-300'}
        />
        <rect
          x="32"
          y="12"
          width="8"
          height="32"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          className={isDark ? 'text-slate-600' : 'text-slate-400'}
        />
        <rect
          x="48"
          y="20"
          width="8"
          height="24"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          className={isDark ? 'text-slate-700' : 'text-slate-300'}
        />
      </motion.svg>

      {/* Title */}
      <div className="mb-2 flex items-center justify-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${isDark ? 'bg-violet-400/40' : 'bg-violet-500/30'}`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${isDark ? 'bg-violet-400/70' : 'bg-violet-500/60'}`}
          />
        </span>

        <h3
          className={`text-sm font-semibold tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h3>
      </div>

      <p
        className={`mx-auto max-w-xs text-sm leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
      >
        {description}
      </p>
    </motion.div>
  )
}
