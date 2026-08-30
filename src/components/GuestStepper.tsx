import { Minus, Plus, Users } from 'lucide-react'
import { useI18n } from '../lib/i18n/provider'
import { cn } from '../lib/utils'

export interface GuestStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  className?: string
  id?: string
}

export function GuestStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  className,
  id,
}: GuestStepperProps) {
  const { t } = useI18n()
  const current = Math.max(min, Math.min(max, value || min))

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (current > min) {
      onChange(current - 1)
    }
  }

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (current < max) {
      onChange(current + 1)
    }
  }

  const guestLabel =
    current === 1
      ? `1 ${t('admin.bookings.guest') || 'Guest'}`
      : `${current} ${t('landing.searchGuests') || 'Guests'}`

  return (
    <div
      id={id}
      className={cn(
        'group relative flex h-11 w-full select-none items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-sm transition-all focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800',
        className,
      )}
      role="group"
      aria-label={t('landing.searchGuests')}
    >
      <div className="flex min-w-0 items-center gap-2 pl-0.5">
        <Users className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-violet-500 dark:text-slate-400" />
        <span className="truncate text-sm font-medium text-slate-800 sm:text-base dark:text-slate-100">
          {guestLabel}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={current <= min}
          aria-label="Decrease guests"
          className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 disabled:hover:text-slate-600 dark:border-slate-700 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/40 dark:hover:text-violet-300 dark:disabled:hover:border-slate-700 dark:disabled:hover:bg-slate-700/60 dark:disabled:hover:text-slate-300"
        >
          <Minus className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={current >= max}
          aria-label="Increase guests"
          className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 disabled:hover:text-slate-600 dark:border-slate-700 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/40 dark:hover:text-violet-300 dark:disabled:hover:border-slate-700 dark:disabled:hover:bg-slate-700/60 dark:disabled:hover:text-slate-300"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
