// Filter controls used to narrow down customer bookings.
import { useI18n } from '../../../../lib/i18n/provider'
import { useTheme } from '../../../../lib/theme'
import { cn } from '../../../../lib/utils'

interface BookingsFiltersProps {
  statusFilter: string
  onFilterChange: (value: string) => void
}

export function BookingsFilters({
  statusFilter,
  onFilterChange,
}: BookingsFiltersProps) {
  // Build localized filter chips for each booking lifecycle status.
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const filters = [
    { value: 'all', label: t('bookings.filter.all') },
    { value: 'held', label: t('bookings.filter.held') },
    { value: 'pending_payment', label: t('bookings.filter.pendingPayment') },
    { value: 'confirmed', label: t('bookings.filter.confirmed') },
    { value: 'checked_in', label: t('bookings.filter.checkedIn') },
    { value: 'checked_out', label: t('bookings.filter.completed') },
    { value: 'cancelled', label: t('bookings.filter.cancelled') },
  ]

  return (
    <div className="mb-6 w-full">
      <div
        className={cn(
          'flex gap-2 overflow-x-auto pb-2 scrollbar-hide',
          'rounded-2xl border p-2',
          'shadow-[0_14px_34px_-28px_rgba(15,23,42,0.5)]',
          isDark
            ? 'border-slate-800/60 bg-slate-900/50'
            : 'border-slate-300/90 bg-white/88 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.28)]',
        )}
      >
        {filters.map((filter) => {
          const isActive = statusFilter === filter.value
          return (
            <button
              type="button"
              key={filter.value}
              onClick={() => onFilterChange(filter.value)}
              className={cn(
                'shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all',
                'focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:outline-none',
                isDark
                  ? 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                  : 'text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900',
                isActive &&
                  (isDark
                    ? 'bg-white text-slate-900 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.35)]'
                    : 'border-white/70 bg-white text-slate-900 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.35)]'),
              )}
            >
              {filter.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
