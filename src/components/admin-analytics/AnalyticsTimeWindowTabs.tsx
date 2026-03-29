import { motion } from 'motion/react'
import { useTheme } from '@/lib/theme'

import type { AnalyticsWindow } from '@/lib/adminAnalytics'
import { analyticsWindowOptions } from '@/lib/adminAnalytics'
import { useI18n } from '@/lib/i18n'

interface Props {
  value: AnalyticsWindow
  onChange: (next: AnalyticsWindow) => void
}

export function AnalyticsTimeWindowTabs({ value, onChange }: Props) {
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const labels: Record<AnalyticsWindow, string> = {
    today: t('admin.analytics.window.today' as never),
    '7d': t('admin.analytics.window.7d' as never),
    '30d': t('admin.analytics.window.30d' as never),
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`inline-flex rounded-2xl border p-1 shadow-lg backdrop-blur-xl ${
        isDark
          ? 'border-slate-800/70 bg-slate-900/60 shadow-black/20'
          : 'border-slate-200 bg-white/80 shadow-slate-200/40'
      }`}
      style={{
        borderTop: isDark
          ? '1px solid rgba(255, 255, 255, 0.05)'
          : '1px solid rgba(255, 255, 255, 0.8)',
      }}
    >
      {analyticsWindowOptions.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="relative z-10 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium transition-colors duration-200 select-none"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {/* Sliding active indicator pill */}
            {active && (
              <motion.div
                layoutId="analytics-tab-indicator"
                className="absolute inset-0 z-0 rounded-xl"
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.20), rgba(167, 139, 250, 0.15))'
                    : 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(124, 58, 237, 0.10))',
                  boxShadow: isDark
                    ? '0 0 12px 2px rgba(139, 92, 246, 0.12), 0 0 24px 4px rgba(167, 139, 250, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                    : '0 0 12px 2px rgba(139, 92, 246, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                }}
                transition={{
                  type: 'spring',
                  stiffness: 350,
                  damping: 30,
                }}
              />
            )}

            {/* Label text */}
            <motion.span
              className="relative z-10"
              animate={{
                color: active
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.95)'
                    : 'rgba(15, 23, 42, 0.95)'
                  : isDark
                    ? 'rgba(100, 116, 139, 1)'
                    : 'rgba(148, 163, 184, 1)',
                scale: active ? 1.02 : 1,
              }}
              whileHover={
                !active
                  ? {
                      color: isDark
                        ? 'rgba(203, 213, 225, 1)'
                        : 'rgba(51, 65, 85, 1)',
                    }
                  : undefined
              }
              transition={{ duration: 0.2 }}
            >
              {labels[option.value]}
            </motion.span>
          </button>
        )
      })}
    </motion.div>
  )
}
