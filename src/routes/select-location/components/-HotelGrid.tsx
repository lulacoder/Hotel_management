import { Link } from '@tanstack/react-router'
import {
  ArrowUpDown,
  Building2,
  Car,
  MapPin,
  Navigation,
  Star,
  Tag,
} from 'lucide-react'

import type { Id } from '../../../../convex/_generated/dataModel'
import { formatDistance } from '../../../lib/distance'
import { categoryColors, SortOption } from './-helpers'

interface HotelGridProps {
  hotels: Array<{
    _id: Id<'hotels'>
    name: string
    city: string
    stateProvince?: string | undefined
    country: string
    description?: string | undefined
    tags?: string[] | undefined
    category?: string | undefined
    rating?: number | undefined
    parkingIncluded?: boolean | undefined
    distance: number | null
  }>
  sortBy: SortOption
  searchTerm: string
  selectedCity: string
  selectedCategory: string
  ratingSummaryByHotelId: Record<string, { average: number; count: number }>
  onOpenRating: (hotelId: Id<'hotels'>) => void
  isLoading: boolean
}

export function HotelGrid({
  hotels,
  sortBy,
  searchTerm,
  selectedCity,
  selectedCategory,
  ratingSummaryByHotelId,
  onOpenRating,
  isLoading,
}: HotelGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500/20 border-t-amber-500"></div>
      </div>
    )
  }

  if (hotels.length === 0) {
    const isFiltered =
      searchTerm || selectedCity !== 'all' || selectedCategory !== 'all'

    return (
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-10 h-10 text-slate-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-300 mb-3">
          {isFiltered ? 'No hotels found' : 'No hotels available'}
        </h3>
        <p className="text-slate-500">
          {isFiltered
            ? 'Try adjusting your search or filters.'
            : 'Check back soon for new listings.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-slate-200">
          {hotels.length} hotel{hotels.length !== 1 ? 's' : ''} available
        </h3>
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <ArrowUpDown className="w-4 h-4" />
          Sorted by{' '}
          {sortBy === 'distance'
            ? 'distance'
            : sortBy === 'rating'
              ? 'rating'
              : 'name'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hotels.map((hotel) => {
          const ratingSummary = ratingSummaryByHotelId[hotel._id]
          const displayRating =
            ratingSummary && ratingSummary.count > 0
              ? ratingSummary.average
              : hotel.rating
          const displayCount = ratingSummary?.count ?? 0

          return (
            <div
              key={hotel._id}
              className="group light-hover-surface bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300"
            >
              <Link
                to="/hotels/$hotelId"
                params={{ hotelId: hotel._id }}
                className="block"
              >
                <div className="h-48 bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Building2 className="w-16 h-16 text-slate-700" />
                  </div>

                  <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
                    {hotel.category && (
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium border ${categoryColors[hotel.category] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}
                      >
                        {hotel.category}
                      </span>
                    )}

                    {displayRating !== undefined && (
                      <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded-lg">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="text-sm text-slate-200 font-medium">
                          {displayRating.toFixed(1)}
                        </span>
                        {displayCount > 0 && (
                          <span className="text-xs text-slate-400">
                            ({displayCount})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {hotel.distance !== null && (
                    <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg">
                      <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-sm text-slate-200 font-medium">
                        {formatDistance(hotel.distance)}
                      </span>
                    </div>
                  )}

                  {hotel.parkingIncluded && (
                    <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-emerald-500/20 backdrop-blur-sm px-2 py-1 rounded-lg border border-emerald-500/30">
                      <Car className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-300">
                        Free Parking
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5 pb-4">
                  <h4 className="text-lg font-semibold text-slate-200 mb-2 group-hover:text-amber-400 transition-colors">
                    {hotel.name}
                  </h4>
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {hotel.city}
                      {hotel.stateProvince && `, ${hotel.stateProvince}`}
                      {hotel.country && ` - ${hotel.country}`}
                    </span>
                  </div>

                  {hotel.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                      {hotel.description}
                    </p>
                  )}

                  {hotel.tags && hotel.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {hotel.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                      {hotel.tags.length > 3 && (
                        <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-500">
                          +{hotel.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>

              <div className="flex items-center justify-between px-5 pb-5">
                <Link
                  to="/hotels/$hotelId"
                  params={{ hotelId: hotel._id }}
                  className="text-amber-400 font-semibold group-hover:translate-x-1 transition-transform"
                >
                  View Rooms →
                </Link>
                <button
                  type="button"
                  onClick={() => onOpenRating(hotel._id)}
                  className="light-hover-amber px-3 py-1.5 text-sm font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-lg transition-all border border-amber-500/30"
                >
                  Rate this hotel
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
