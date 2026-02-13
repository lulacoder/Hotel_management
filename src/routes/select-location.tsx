import {
  createFileRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { useState, useEffect, useMemo } from 'react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { useGeolocation } from '../hooks/useGeolocation'
import { calculateDistance } from '../lib/distance'
import { SelectLocationHeader } from './select-location/components/-SelectLocationHeader'
import { HeroSection } from './select-location/components/-HeroSection'
import { SearchFilters } from './select-location/components/-SearchFilters'
import { HotelGrid } from './select-location/components/-HotelGrid'
import { RatingModal } from './select-location/components/-RatingModal'
import { SortOption } from './select-location/components/-helpers'

export const Route = createFileRoute('/select-location')({
  component: SelectLocationPage,
})

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
  const categories = useMemo<string[]>(() => {
    if (!hotels) return []
    const values = hotels.flatMap((hotel) =>
      hotel.category ? [hotel.category] : [],
    )
    return [...new Set(values)].sort()
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
      <SelectLocationHeader
        isSignedIn={Boolean(isSignedIn)}
        userName={
          user?.firstName || user?.emailAddresses[0]?.emailAddress || ''
        }
      />

      <HeroSection
        locationSupported={locationSupported ?? false}
        locationLoading={locationLoading ?? false}
        hasUserLocation={hasUserLocation}
        locationError={locationError}
        requestLocation={requestLocation}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
      >
        <SearchFilters
          selectedCity={selectedCity}
          onCityChange={setSelectedCity}
          cities={cities ?? []}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={categories}
          sortBy={sortBy}
          onSortChange={setSortBy}
          hasUserLocation={hasUserLocation}
        />
      </HeroSection>

      <main className="max-w-7xl mx-auto px-4 pb-20">
        <HotelGrid
          hotels={filteredHotels}
          sortBy={sortBy}
          searchTerm={searchTerm}
          selectedCity={selectedCity}
          selectedCategory={selectedCategory}
          ratingSummaryByHotelId={ratingSummaryByHotelId}
          onOpenRating={openRatingModal}
          isLoading={hotels === undefined}
        />
      </main>

      {activeRatingHotelId && (
        <RatingModal
          isSignedIn={Boolean(isSignedIn)}
          hotelName={activeHotel?.name || ''}
          hasExistingRating={Boolean(hasExistingRating)}
          ratingValue={ratingValue}
          ratingText={ratingText}
          ratingError={ratingError}
          ratingSaving={ratingSaving}
          ratingRedirect={ratingRedirect}
          onClose={closeRatingModal}
          onSubmit={handleSubmitRating}
          onRatingChange={setRatingValue}
          onRatingTextChange={setRatingText}
        />
      )}
    </div>
  )
}
