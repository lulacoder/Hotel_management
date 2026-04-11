// Filter controls used to narrow down customer bookings.
import { useI18n } from '../../../../lib/i18n'
import { useTheme } from '../../../../lib/theme'
import { Tabs, TabsList, TabsTrigger } from '../../../../components/ui/tabs'

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
    <Tabs
      value={statusFilter}
      onValueChange={onFilterChange}
      className="mb-6 w-full"
    >
      <TabsList
        className={`h-auto w-full flex-wrap justify-start rounded-2xl border p-1 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.5)] ${
          isDark
            ? 'border-slate-800/60 bg-slate-900/50'
            : 'border-slate-300/90 bg-white/88 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.28)]'
        }`}
      >
        {filters.map((filter) => (
          <TabsTrigger
            key={filter.value}
            value={filter.value}
            className={`rounded-xl px-4 py-2 text-sm transition-all ${
              isDark
                ? 'hover:bg-slate-800/80 hover:text-slate-100 data-[state=active]:bg-white data-[state=active]:text-slate-900'
                : 'text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 data-[state=active]:border-white/70 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_8px_18px_-14px_rgba(15,23,42,0.35)]'
            }`}
          >
            {filter.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
