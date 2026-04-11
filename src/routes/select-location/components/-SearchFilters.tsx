// Search and filter controls for city/category selection and sorting.
import { useI18n } from '../../../lib/i18n'
import { getHotelCategoryLabel } from '../../../lib/hotelCategories'
import { useTheme } from '../../../lib/theme'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const triggerClass = isDark
    ? 'h-12 flex-1 rounded-xl border-slate-700/60 bg-slate-800/60 text-slate-100 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.7)] transition-all hover:border-slate-600 hover:bg-slate-800/80 focus-visible:border-violet-500/60 focus-visible:ring-violet-500/20'
    : 'h-12 flex-1 rounded-xl border-slate-300/90 bg-white/92 text-slate-800 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.3)] transition-all hover:border-violet-300 hover:bg-white focus-visible:border-violet-500/60 focus-visible:ring-violet-500/20'
  const contentClass = isDark
    ? 'border border-slate-800/70 bg-slate-900/96 text-slate-100 shadow-[0_24px_48px_-28px_rgba(2,6,23,0.75)]'
    : 'border border-slate-200/90 bg-white/97 text-slate-900 shadow-[0_26px_56px_-30px_rgba(15,23,42,0.28)]'
  const itemClass = isDark
    ? 'text-slate-200 focus:bg-violet-500/15 focus:text-slate-50'
    : 'text-slate-700 focus:bg-violet-50 focus:text-violet-950'

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Select value={selectedCity} onValueChange={onCityChange}>
        <SelectTrigger className={triggerClass}>
          <SelectValue placeholder={t('select.allCities')} />
        </SelectTrigger>
        <SelectContent className={contentClass} position="popper">
          <SelectItem className={itemClass} value="all">
            {t('select.allCities')}
          </SelectItem>
          {cities.map((city) => (
            <SelectItem className={itemClass} key={city} value={city}>
              {city}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className={triggerClass}>
          <SelectValue placeholder={t('select.allCategories')} />
        </SelectTrigger>
        <SelectContent className={contentClass} position="popper">
          <SelectItem className={itemClass} value="all">
            {t('select.allCategories')}
          </SelectItem>
          {categories.map((cat) => (
            <SelectItem className={itemClass} key={cat} value={cat}>
              {getHotelCategoryLabel(cat, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sortBy}
        onValueChange={(value) => onSortChange(value as SortOption)}
      >
        <SelectTrigger className={triggerClass}>
          <SelectValue placeholder={t('select.sortByName')} />
        </SelectTrigger>
        <SelectContent className={contentClass} position="popper">
          <SelectItem className={itemClass} value="name">
            {t('select.sortByName')}
          </SelectItem>
          <SelectItem className={itemClass} value="rating">
            {t('select.sortByRating')}
          </SelectItem>
          {hasUserLocation && (
            <SelectItem className={itemClass} value="distance">
              {t('select.sortByDistance')}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
