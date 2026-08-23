import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Building2, ChevronRight, Compass, MapPin, Search, Star } from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import { useQuery } from '../../../integrations/convex/hooks'
import { useI18n } from '../../../lib/i18n/provider'
import { getHotelCategoryLabel } from '../../../lib/hotelCategories'
import { categoryColors } from '../../select-location/components/-helpers'
import type { Id } from '../../../../convex/_generated/dataModel'

interface HeroSearchAutocompleteProps {
  searchTerm: string
  isOpen: boolean
  onClose: () => void
  onSelectCity: (city: string) => void
  onSelectHotel: (hotel: { id: Id<'hotels'>; name: string }) => void
  onSelectViewAll?: (query: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

type AutocompleteItem =
  | { type: 'city'; city: string; count: number }
  | {
      type: 'hotel'
      id: Id<'hotels'>
      name: string
      city: string
      rating?: number
      category?: string
      imageUrl?: string
    }
  | { type: 'view_all'; query: string }

export function HeroSearchAutocomplete({
  searchTerm,
  isOpen,
  onClose,
  onSelectCity,
  onSelectHotel,
  onSelectViewAll,
  inputRef,
}: HeroSearchAutocompleteProps) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const listboxId = useId()

  const hotels = useQuery(api.hotels.list, {})
  const trimmed = searchTerm.trim().toLowerCase()

  // Build structured autocomplete recommendations
  const { cityMatches, hotelMatches, isZeroState } = useMemo(() => {
    if (!hotels) {
      return { cityMatches: [], hotelMatches: [], isZeroState: true }
    }

    // City aggregation
    const cityCounts: Record<string, number> = {}
    for (const hotel of hotels) {
      if (hotel.city) {
        cityCounts[hotel.city] = (cityCounts[hotel.city] || 0) + 1
      }
    }

    if (!trimmed) {
      // Zero-state: Show popular unique cities and top-rated hotels
      const popularCities = Object.entries(cityCounts)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)

      const topHotels = [...hotels]
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 3)

      return {
        cityMatches: popularCities,
        hotelMatches: topHotels,
        isZeroState: true,
      }
    }

    // Filter cities matching search term
    const matchedCities = Object.entries(cityCounts)
      .filter(([city]) => city.toLowerCase().includes(trimmed))
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    // Filter hotels matching name, city, tags, address, or category
    const matchedHotels = hotels
      .filter((hotel) => {
        const nameMatch = hotel.name.toLowerCase().includes(trimmed)
        const cityMatch = hotel.city.toLowerCase().includes(trimmed)
        const categoryMatch = hotel.category?.toLowerCase().includes(trimmed)
        const tagsMatch = hotel.tags?.some((tag) =>
          tag.toLowerCase().includes(trimmed),
        )
        const addressMatch = hotel.address.toLowerCase().includes(trimmed)
        return (
          nameMatch ||
          cityMatch ||
          categoryMatch ||
          tagsMatch ||
          addressMatch
        )
      })
      .slice(0, 4)

    return {
      cityMatches: matchedCities,
      hotelMatches: matchedHotels,
      isZeroState: false,
    }
  }, [hotels, trimmed])

  // Flatten items for linear keyboard navigation
  const flatItems = useMemo<Array<AutocompleteItem>>(() => {
    const items: Array<AutocompleteItem> = []
    for (const city of cityMatches) {
      items.push({ type: 'city', city: city.city, count: city.count })
    }
    for (const hotel of hotelMatches) {
      items.push({
        type: 'hotel',
        id: hotel._id,
        name: hotel.name,
        city: hotel.city,
        rating: hotel.rating,
        category: hotel.category,
        imageUrl: hotel.imageUrl,
      })
    }
    if (trimmed.length > 0) {
      items.push({ type: 'view_all', query: searchTerm.trim() })
    }
    return items
  }, [cityMatches, hotelMatches, searchTerm, trimmed])

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [trimmed])

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, onClose, inputRef])

  // Select hotel and update form state
  const handleSelectHotel = (hotel: { id: Id<'hotels'>; name: string }) => {
    onSelectHotel(hotel)
    onClose()
  }

  // Select city and update form state
  const handleSelectCity = (city: string) => {
    onSelectCity(city)
    onClose()
  }

  const handleSelectViewAll = (query: string) => {
    if (onSelectViewAll) {
      onSelectViewAll(query)
    } else {
      onSelectCity(query)
    }
    onClose()
  }

  // Keyboard navigation handler for parent input
  useEffect(() => {
    if (!isOpen) return

    const input = inputRef.current
    if (!input) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((prev) =>
          prev < flatItems.length - 1 ? prev + 1 : 0,
        )
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flatItems.length - 1,
        )
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
          event.preventDefault()
          const item = flatItems[selectedIndex]
          if (item.type === 'city') {
            handleSelectCity(item.city)
          } else if (item.type === 'hotel') {
            handleSelectHotel({ id: item.id, name: item.name })
          } else {
            handleSelectViewAll(item.query)
          }
        }
      }
    }

    input.addEventListener('keydown', handleKeyDown)
    return () => input.removeEventListener('keydown', handleKeyDown)
  }, [
    isOpen,
    selectedIndex,
    flatItems,
    onClose,
    inputRef,
  ])

  if (!isOpen) return null

  const hasNoResults =
    !isZeroState && cityMatches.length === 0 && hotelMatches.length === 0

  return (
    <div
      ref={containerRef}
      id={listboxId}
      role="listbox"
      aria-label="Search suggestions"
      className="absolute top-full left-0 z-50 mt-2 max-h-[460px] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl sm:min-w-[420px] dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-black/70"
    >
      {/* Loading state */}
      {hotels === undefined && (
        <div className="flex items-center gap-3 px-3 py-6 text-sm text-slate-500">
          <div className="size-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span>{t('select.gettingLocation')}</span>
        </div>
      )}

      {/* No results state */}
      {hasNoResults && (
        <div className="px-3 py-6 text-center">
          <Building2 className="mx-auto mb-2 size-8 text-slate-400 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {t('landing.noMatchesFound')}
          </p>
          <button
            type="button"
            onClick={() => handleSelectViewAll(searchTerm.trim())}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-400"
          >
            {t('landing.viewAllFor', { query: searchTerm.trim() })}
            <ChevronRight className="size-3" />
          </button>
        </div>
      )}

      {/* Destinations / Cities section */}
      {cityMatches.length > 0 && (
        <div className="mb-3">
          <p className="px-3 py-1 text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
            {isZeroState
              ? t('landing.popularDestinations')
              : t('landing.destinations')}
          </p>
          <div className="mt-1 space-y-1">
            {cityMatches.map((item) => {
              const flatIndex = flatItems.findIndex(
                (fi) => fi.type === 'city' && fi.city === item.city,
              )
              const isSelected = selectedIndex === flatIndex

              return (
                <button
                  key={item.city}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectCity(item.city)}
                  onMouseEnter={() => setSelectedIndex(flatIndex)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-violet-50 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        isSelected
                          ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/25'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {isZeroState ? (
                        <Compass className="size-4" />
                      ) : (
                        <MapPin className="size-4" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.city}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-200/80 bg-slate-100/90 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-slate-300">
                      {item.count === 1
                        ? t('landing.oneHotelCount')
                        : t('landing.hotelsCount', { count: item.count })}
                    </span>
                    <ChevronRight className="size-4 text-slate-400 opacity-60" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Hotels section */}
      {hotelMatches.length > 0 && (
        <div className="mb-2">
          <p className="px-3 py-1 text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
            {isZeroState ? t('landing.hotelCarouselKicker') : t('landing.matchingHotels')}
          </p>
          <div className="mt-1 space-y-1">
            {hotelMatches.map((hotel) => {
              const flatIndex = flatItems.findIndex(
                (fi) => fi.type === 'hotel' && fi.id === hotel._id,
              )
              const isSelected = selectedIndex === flatIndex

              return (
                <button
                  key={hotel._id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() =>
                    handleSelectHotel({ id: hotel._id, name: hotel.name })
                  }
                  onMouseEnter={() => setSelectedIndex(flatIndex)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl p-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-violet-50 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-slate-200 shadow-sm dark:bg-slate-800">
                      {hotel.imageUrl ? (
                        <img
                          src={hotel.imageUrl}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-slate-400">
                          <Building2 className="size-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {hotel.name}
                        </span>
                        {hotel.category && (
                          <span
                            className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                              categoryColors[hotel.category] ||
                              'border-slate-500/30 bg-slate-700 text-slate-200'
                            }`}
                          >
                            {getHotelCategoryLabel(hotel.category, t)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="truncate">{hotel.city}</span>
                        {hotel.rating !== undefined && (
                          <span className="inline-flex items-center gap-0.5 font-medium text-amber-500">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {hotel.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="ml-2 size-4 shrink-0 text-slate-400 opacity-60" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer shortcut: View all matching */}
      {trimmed.length > 0 && (
        <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
          <button
            type="button"
            role="option"
            aria-selected={
              selectedIndex === flatItems.findIndex((fi) => fi.type === 'view_all')
            }
            onClick={() => handleSelectViewAll(searchTerm.trim())}
            className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-500/15"
          >
            <span className="flex items-center gap-2">
              <Search className="size-4" />
              {t('landing.viewAllFor', { query: searchTerm.trim() })}
            </span>
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
