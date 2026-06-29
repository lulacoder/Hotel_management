import type { ReactNode } from 'react'

interface AnalyticsTooltipProps {
  detail?: ReactNode
  isDark: boolean
  label: ReactNode
  markerColor?: string
  value: ReactNode
}

export function AnalyticsTooltip({
  detail,
  isDark,
  label,
  markerColor,
  value,
}: AnalyticsTooltipProps) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur-md ${
        isDark
          ? 'border-slate-700/60 bg-slate-900/95 shadow-black/40'
          : 'border-slate-200 bg-white/95 shadow-slate-200/40'
      }`}
    >
      <div className="flex items-center gap-2">
        {markerColor ? (
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: markerColor }}
          />
        ) : null}
        <p
          className={`text-[11px] font-medium tracking-wide ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {label}
        </p>
      </div>
      <p
        className={`mt-1 text-sm font-bold tabular-nums ${
          isDark ? 'text-slate-50' : 'text-slate-900'
        }`}
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {value}
      </p>
      {detail ? (
        <p
          className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        >
          {detail}
        </p>
      ) : null}
    </div>
  )
}
