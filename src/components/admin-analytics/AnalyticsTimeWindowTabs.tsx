import { motion } from 'motion/react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AnalyticsWindow } from '@/lib/adminAnalytics'
import { analyticsWindowOptions } from '@/lib/adminAnalytics'
import { useI18n } from '@/lib/i18n'

interface Props {
  value: AnalyticsWindow
  onChange: (next: AnalyticsWindow) => void
}

export function AnalyticsTimeWindowTabs({ value, onChange }: Props) {
  const { t } = useI18n()

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
    >
      <Tabs
        value={value}
        onValueChange={(next) => onChange(next as AnalyticsWindow)}
      >
        <TabsList className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-1 shadow-lg shadow-black/20 backdrop-blur-xl">
          {analyticsWindowOptions.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-400 transition-colors data-[state=active]:bg-violet-500/10 data-[state=active]:text-slate-100 data-[state=active]:shadow-none"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {labels[option.value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </motion.div>
  )
}
