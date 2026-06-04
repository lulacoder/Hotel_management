import { m } from 'motion/react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AnalyticsWindow } from '@/lib/adminAnalytics'
import { analyticsWindowOptions } from '@/lib/adminAnalytics'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'

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
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Tabs
        value={value}
        onValueChange={(next) => onChange(next as AnalyticsWindow)}
      >
        <TabsList
          className={`rounded-2xl border p-1 shadow-lg backdrop-blur-xl ${
            isDark
              ? 'border-slate-800/70 bg-slate-900/60 shadow-black/20'
              : 'border-slate-300/90 bg-white/95 shadow-slate-300/70'
          }`}
        >
          {analyticsWindowOptions.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className={`min-w-[4.5rem] rounded-xl px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                isDark
                  ? 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100 data-[state=active]:border-violet-400/20 data-[state=active]:bg-violet-500/10 data-[state=active]:text-slate-100'
                  : 'text-slate-500 hover:bg-violet-50 hover:text-violet-700 data-[state=active]:border-violet-200/90 data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700'
              } data-[state=active]:shadow-none`}
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {labels[option.value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </m.div>
  )
}
