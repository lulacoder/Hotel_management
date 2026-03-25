// Search and filter controls for city/category selection and sorting.
import { useI18n } from '../../../lib/i18n'
import { getHotelCategoryLabel } from '../../../lib/hotelCategories'
import type { SortOption } from './-helpers'

interface SearchFiltersProps {
  selectedCity: string
  onCityChange: (value: string) => void
  cities: Array<string>
  selectedCategory: string
  onCategoryChange: (value: string) => void
  categories: Array<string>
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
  // Controlled filter inputs drive parent-managed search and sort state.
  const { t } = useI18n()

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <select
        value={selectedCity}
        onChange={(event) => onCityChange(event.target.value)}
        className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
      >
        <option value="all">{t('select.allCities')}</option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>

      <select
        value={selectedCategory}
        onChange={(event) => onCategoryChange(event.target.value)}
        className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
      >
        <option value="all">{t('select.allCategories')}</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {getHotelCategoryLabel(cat, t)}
          </option>
        ))}
      </select>

      <select
        value={sortBy}
        onChange={(event) => onSortChange(event.target.value as SortOption)}
        className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
      >
        <option value="name">{t('select.sortByName')}</option>
        <option value="rating">{t('select.sortByRating')}</option>
        {hasUserLocation && (
          <option value="distance">{t('select.sortByDistance')}</option>
        )}
      </select>
    </div>
  )
}
