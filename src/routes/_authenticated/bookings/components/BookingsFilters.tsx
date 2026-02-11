interface BookingsFiltersProps {
  statusFilter: string
  onFilterChange: (value: string) => void
}

const filters = [
  { value: 'all', label: 'All' },
  { value: 'held', label: 'Held' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'checked_out', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function BookingsFilters({
  statusFilter,
  onFilterChange,
}: BookingsFiltersProps) {
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
