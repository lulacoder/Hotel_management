import { useI18n } from '../../../../lib/i18n'

interface BookingsFiltersProps {
  statusFilter: string
  onFilterChange: (value: string) => void
}

export function BookingsFilters({
  statusFilter,
  onFilterChange,
}: BookingsFiltersProps) {
  const { t } = useI18n()
  const filters = [
    { value: 'all', label: t('bookings.filter.all') },
    { value: 'held', label: t('bookings.filter.held') },
    { value: 'confirmed', label: t('bookings.filter.confirmed') },
    { value: 'checked_in', label: t('bookings.filter.checkedIn') },
    { value: 'checked_out', label: t('bookings.filter.completed') },
    { value: 'cancelled', label: t('bookings.filter.cancelled') },
  ]

  return (
    <div className="mb-6 flex gap-2 flex-wrap">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === filter.value
              ? 'bg-amber-500 text-slate-900'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}
