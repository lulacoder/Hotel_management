import {
  createFileRoute,
  Link,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useUser, UserButton } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import {
  MapPin,
  Search,
  Building2,
  Star,
  Navigation,
  Car,
  Tag,
  ArrowUpDown,
  Loader2,
  X,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'

import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import {
  useGeolocation,
  getGeolocationErrorMessage,
} from '../hooks/useGeolocation'
import { calculateDistance, formatDistance } from '../lib/distance'

export const Route = createFileRoute('/select-location')({
  component: SelectLocationPage,
})

type SortOption = 'name' | 'rating' | 'distance'

// Category badge colors
const categoryColors: Record<string, string> = {
  Boutique: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Budget: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Luxury: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Resort and Spa': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Extended-Stay': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Suite: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
}

function SelectLocationPage() {
  const { user, isSignedIn } = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCity, setSelectedCity] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [locationRequested, setLocationRequested] = useState(false)
  const [activeRatingHotelId, setActiveRatingHotelId] =
    useState<Id<'hotels'> | null>(null)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingText, setRatingText] = useState('')
  const [ratingError, setRatingError] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)
  const [ratingPrefillKey, setRatingPrefillKey] = useState<string | null>(null)
  const [autoOpenHandled, setAutoOpenHandled] = useState(false)

  const hotels = useQuery(api.hotels.list, {})
  const cities = useQuery(api.hotels.getCities, {})
  const ratingSummaries = useQuery(
    api.ratings.getSummaries,
    hotels && hotels.length > 0
      ? { hotelIds: hotels.map((hotel) => hotel._id) }
      : 'skip',
  )
  const upsertRating = useMutation(api.ratings.upsertRating)

  const myRating = useQuery(
    api.ratings.getMyRatingForHotel,
    user?.id && activeRatingHotelId
      ? { clerkUserId: user.id, hotelId: activeRatingHotelId }
      : 'skip',
  )

  // Geolocation hook
  const {
    latitude: userLat,
    longitude: userLng,
    loading: locationLoading,
    error: locationError,
    requestLocation,
    supported: locationSupported,
  } = useGeolocation()

  // Request location on mount
  useEffect(() => {
    if (locationSupported && !locationRequested) {
      setLocationRequested(true)
      requestLocation()
    }
  }, [locationSupported, locationRequested, requestLocation])

  useEffect(() => {
    if (autoOpenHandled || !hotels) {
      return
    }

    const params = new URLSearchParams(location.search)
    const rateHotelId = params.get('rate')

    if (!rateHotelId) {
      return
    }

    const matchedHotel = hotels.find((hotel) => hotel._id === rateHotelId)
    if (!matchedHotel) {
      return
    }

    setActiveRatingHotelId(matchedHotel._id)
    setAutoOpenHandled(true)
    navigate({ to: '/select-location', replace: true })
  }, [autoOpenHandled, hotels, location.search, navigate])

  useEffect(() => {
    if (!activeRatingHotelId || myRating === undefined) {
      return
    }

    const prefillKey = `${activeRatingHotelId}:${myRating?._id ?? 'new'}`
    if (prefillKey === ratingPrefillKey) {
      return
    }

    setRatingValue(myRating?.rating ?? 0)
    setRatingText(myRating?.review ?? '')
    setRatingError('')
    setRatingPrefillKey(prefillKey)
  }, [activeRatingHotelId, myRating, ratingPrefillKey])

  // Compute hotels with distance
  const hotelsWithDistance = useMemo(() => {
    if (!hotels) return []

    return hotels.map((hotel) => {
      let distance: number | null = null

      if (userLat && userLng && hotel.location) {
        distance = calculateDistance(
          userLat,
          userLng,
          hotel.location.lat,
          hotel.location.lng,
        )
      }

    return { ...hotel, distance }
  })
  }, [hotels, userLat, userLng])

  const ratingSummaryByHotelId = useMemo(() => {
    const map: Record<string, { average: number; count: number }> = {}

    if (!ratingSummaries) {
      return map
    }

    for (const summary of ratingSummaries) {
      map[summary.hotelId] = {
        average: summary.average,
        count: summary.count,
      }
    }

    return map
  }, [ratingSummaries])

  // Get unique categories
  const categories = useMemo(() => {
    if (!hotels) return []
    const cats = hotels
      .map((h) => h.category)
      .filter((c): c is string => c !== undefined)
    return [...new Set(cats)].sort()
  }, [hotels])

  // Filter and sort hotels
  const filteredHotels = useMemo(() => {
    let result = hotelsWithDistance.filter((hotel) => {
      const matchesSearch =
        hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hotel.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hotel.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (hotel.description?.toLowerCase().includes(searchTerm.toLowerCase()) ??
          false) ||
        (hotel.tags?.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ??
          false)
      const matchesCity = selectedCity === 'all' || hotel.city === selectedCity
      const matchesCategory =
        selectedCategory === 'all' || hotel.category === selectedCategory
      return matchesSearch && matchesCity && matchesCategory
    })

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          // Hotels without location go to the end
          if (a.distance === null && b.distance === null) return 0
          if (a.distance === null) return 1
          if (b.distance === null) return -1
          return a.distance - b.distance
        case 'rating':
          const ratingA =
            ratingSummaryByHotelId[a._id]?.average ?? a.rating ?? 0
          const ratingB =
            ratingSummaryByHotelId[b._id]?.average ?? b.rating ?? 0
          return ratingB - ratingA // Higher rating first
        case 'name':
        default:
          return a.name.localeCompare(b.name)
      }
    })

    return result
  }, [
    hotelsWithDistance,
    searchTerm,
    selectedCity,
    selectedCategory,
    sortBy,
    ratingSummaryByHotelId,
  ])

  const hasUserLocation = userLat !== null && userLng !== null
  const activeHotel = useMemo(() => {
    if (!activeRatingHotelId || !hotels) {
      return null
    }
    return hotels.find((hotel) => hotel._id === activeRatingHotelId) ?? null
  }, [activeRatingHotelId, hotels])
  const hasExistingRating = Boolean(myRating)
  const ratingRedirect = activeRatingHotelId
    ? `/select-location?rate=${activeRatingHotelId}`
    : '/select-location'

  const openRatingModal = (hotelId: Id<'hotels'>) => {
    setActiveRatingHotelId(hotelId)
    setRatingError('')
  }

  const closeRatingModal = () => {
    setActiveRatingHotelId(null)
    setRatingValue(0)
    setRatingText('')
    setRatingError('')
    setRatingPrefillKey(null)
  }

  const handleSubmitRating = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.id || !activeRatingHotelId) {
      return
    }

    if (ratingValue < 1 || ratingValue > 5) {
      setRatingError('Please select a rating between 1 and 5.')
      return
    }

    setRatingSaving(true)
    setRatingError('')

    try {
      await upsertRating({
        clerkUserId: user.id,
        hotelId: activeRatingHotelId,
        rating: ratingValue,
        review: ratingText.trim() || undefined,
      })
      closeRatingModal()
    } catch (err: any) {
      setRatingError(err.message || 'Failed to save rating.')
    } finally {
      setRatingSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-100">
              Hotel Booking
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <>
                <Link
                  to="/bookings"
                  className="text-slate-400 hover:text-amber-400 transition-colors font-medium"
                >
                  My Bookings
                </Link>
                <span className="text-sm text-slate-500">
                  {user?.firstName || user?.emailAddresses[0]?.emailAddress}
                </span>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <Link
                  to="/sign-in"
                  className="text-slate-400 hover:text-amber-400 transition-colors font-medium"
                >
                  Sign In
                </Link>
                <Link
                  to="/sign-up"
                  className="px-3 py-1.5 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-violet-500/5"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4 tracking-tight">
            Find Your Perfect Stay
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            Browse our curated selection of hotels and book your next adventure.
          </p>

          {/* Location Status Banner */}
          {locationSupported && (
            <div className="mb-6">
              {locationLoading ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Getting your location...
                </div>
              ) : hasUserLocation ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
                  <Navigation className="w-4 h-4" />
                  Location enabled - showing hotels sorted by distance
                </div>
              ) : locationError ? (
                <button
                  onClick={requestLocation}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-slate-400 text-sm transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  {getGeolocationErrorMessage(locationError).substring(0, 50)}
                  ...
                  <span className="text-amber-400 ml-1">Try again</span>
                </button>
              ) : null}
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex flex-col gap-4 max-w-3xl mx-auto">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search hotels, cities, or amenities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
              >
                <option value="all">All Cities</option>
                {cities?.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
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
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
              >
                <option value="name">Sort by Name</option>
                <option value="rating">Sort by Rating</option>
                {hasUserLocation && (
                  <option value="distance">Sort by Distance</option>
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Hotels Grid */}
      <main className="max-w-7xl mx-auto px-4 pb-20">
        {hotels === undefined ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500/20 border-t-amber-500"></div>
          </div>
        ) : filteredHotels.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-300 mb-3">
              {searchTerm ||
              selectedCity !== 'all' ||
              selectedCategory !== 'all'
                ? 'No hotels found'
                : 'No hotels available'}
            </h3>
            <p className="text-slate-500">
              {searchTerm ||
              selectedCity !== 'all' ||
              selectedCategory !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Check back soon for new listings.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-200">
                {filteredHotels.length} hotel
                {filteredHotels.length !== 1 ? 's' : ''} available
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
              {filteredHotels.map((hotel) => {
                const ratingSummary = ratingSummaryByHotelId[hotel._id]
                const displayRating =
                  ratingSummary && ratingSummary.count > 0
                    ? ratingSummary.average
                    : hotel.rating
                const displayCount = ratingSummary?.count ?? 0

                return (
                  <div
                    key={hotel._id}
                    className="group bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300"
                  >
                    <Link
                      to="/hotels/$hotelId"
                      params={{ hotelId: hotel._id }}
                      className="block"
                    >
                      {/* Placeholder Image */}
                  <div className="h-48 bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Building2 className="w-16 h-16 text-slate-700" />
                    </div>

                    {/* Top badges row */}
                    <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
                      {/* Category Badge */}
                      {hotel.category && (
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium border ${categoryColors[hotel.category] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}
                        >
                          {hotel.category}
                        </span>
                      )}

                      {/* Rating Badge */}
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

                    {/* Distance Badge (bottom left) */}
                    {hotel.distance !== null && (
                      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg">
                        <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-sm text-slate-200 font-medium">
                          {formatDistance(hotel.distance)}
                        </span>
                      </div>
                    )}

                    {/* Parking Badge (bottom right) */}
                    {hotel.parkingIncluded && (
                      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-emerald-500/20 backdrop-blur-sm px-2 py-1 rounded-lg border border-emerald-500/30">
                        <Car className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs text-emerald-300">
                          Free Parking
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
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

                    {/* Description */}
                    {hotel.description && (
                      <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                        {hotel.description}
                      </p>
                    )}

                    {/* Tags */}
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
                    onClick={() => openRatingModal(hotel._id)}
                    className="px-3 py-1.5 text-sm font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
                  >
                    Rate this hotel
                  </button>
                </div>
              </div>
              )
            })}
            </div>
          </>
        )}
      </main>

      {activeRatingHotelId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-100">
                  {hasExistingRating ? 'Update Rating' : 'Rate This Hotel'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {activeHotel?.name || 'Share your experience'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRatingModal}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Close rating modal"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6">
              {!isSignedIn ? (
                <div className="space-y-5">
                  <p className="text-slate-400">
                    Sign in to leave a rating for this hotel.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: '/sign-in',
                          search: { redirect: ratingRedirect },
                        })
                      }
                      className="flex-1 px-4 py-3 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: '/sign-up',
                          search: { redirect: ratingRedirect },
                        })
                      }
                      className="flex-1 px-4 py-3 bg-amber-500 text-slate-900 font-semibold rounded-xl hover:bg-amber-400 transition-colors"
                    >
                      Sign Up
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitRating} className="space-y-5">
                  {ratingError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                      {ratingError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Your Rating
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRatingValue(value)}
                          className="p-1"
                          aria-label={`Rate ${value} star`}
                        >
                          <Star
                            className={`w-6 h-6 ${
                              value <= ratingValue
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-sm text-slate-500 ml-2">
                        {ratingValue > 0
                          ? `${ratingValue}/5`
                          : 'Select a rating'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Review (optional)
                    </label>
                    <textarea
                      rows={4}
                      value={ratingText}
                      onChange={(event) => setRatingText(event.target.value)}
                      maxLength={500}
                      placeholder="Share anything you liked about your stay."
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      {ratingText.length}/500
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={closeRatingModal}
                      className="flex-1 px-4 py-3 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={ratingSaving}
                      className="flex-1 px-4 py-3 bg-amber-500 text-slate-900 font-semibold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-60"
                    >
                      {ratingSaving ? 'Saving...' : 'Save Rating'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
