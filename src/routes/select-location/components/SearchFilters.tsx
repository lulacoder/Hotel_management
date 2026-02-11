import { SortOption } from './helpers'

interface SearchFiltersProps {
  selectedCity: string
  onCityChange: (value: string) => void
  cities: string[]
  selectedCategory: string
  onCategoryChange: (value: string) => void
  categories: string[]
  sortBy: SortOption
  onSortChange: (value: SortOption) => void
  hasUserLocation: boolean
}

export function SearchFilters({
  selectedCity,
  onCityChange,
  cities,
  selectedCategory,
  onCategoryChange,
  categories,
  sortBy,
  onSortChange,
  hasUserLocation,
}: SearchFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <select
        value={selectedCity}
        onChange={(event) => onCityChange(event.target.value)}
        className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
      >
        <option value="all">All Cities</option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>

      <select
        value={selectedCategory}
        onChange={(event) => onCategoryChange(event.target.value)}
        className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
      >
        <option value="all">All Categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      <select
        value={sortBy}
        onChange={(event) => onSortChange(event.target.value as SortOption)}
        className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
      >
        <option value="name">Sort by Name</option>
        <option value="rating">Sort by Rating</option>
        {hasUserLocation && <option value="distance">Sort by Distance</option>}
      </select>
    </div>
  )
}
