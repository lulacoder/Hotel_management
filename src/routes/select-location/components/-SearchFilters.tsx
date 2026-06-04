// Search and filter controls for city/category selection and sorting.
import { useI18n } from '../../../lib/i18n/provider'
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

  const chipBaseClass = isDark
    ? 'rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-300 text-xs font-medium px-3 py-1.5 whitespace-nowrap transition-colors hover:border-violet-500/40 hover:text-slate-100'
    : 'rounded-lg border border-slate-300/80 bg-white/80 text-slate-600 text-xs font-medium px-3 py-1.5 whitespace-nowrap transition-colors hover:border-violet-400 hover:text-slate-800'

  const chipActiveClass = isDark
    ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
    : 'border-violet-400/60 bg-violet-50 text-violet-700'

  const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: 'name', label: t('select.sortByName') },
    { value: 'rating', label: t('select.sortByRating') },
    ...(hasUserLocation
      ? [{ value: 'distance' as SortOption, label: t('select.sortByDistance') }]
      : []),
  ]

  return (
    <>
      {/* Mobile: horizontal scrollable chips */}
      <div className="flex sm:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {/* City chip */}
        <Select value={selectedCity} onValueChange={onCityChange}>
          <SelectTrigger
            className={`h-auto py-1.5 px-3 min-w-0 ${selectedCity !== 'all' ? chipActiveClass : chipBaseClass}`}
          >
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

        {/* Category chip */}
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger
            className={`h-auto py-1.5 px-3 min-w-0 ${selectedCategory !== 'all' ? chipActiveClass : chipBaseClass}`}
          >
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

        {/* Sort chip */}
        <Select
          value={sortBy}
          onValueChange={(value) => onSortChange(value as SortOption)}
        >
          <SelectTrigger
            className={`h-auto py-1.5 px-3 min-w-0 ${chipBaseClass}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={contentClass} position="popper">
            {sortOptions.map((option) => (
              <SelectItem
                className={itemClass}
                key={option.value}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: stacked dropdowns */}
      <div className="hidden sm:flex sm:flex-row gap-3">
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
    </>
  )
}
