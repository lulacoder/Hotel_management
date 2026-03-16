// Hotel discovery route with geolocation, search filters, sorting, and rating workflow.
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'

import { api } from '../../convex/_generated/api'
import { useGeolocation } from '../hooks/useGeolocation'
import { calculateDistance } from '../lib/distance'
import { useI18n } from '../lib/i18n'
import { SelectLocationHeader } from './select-location/components/-SelectLocationHeader'
import { HeroSection } from './select-location/components/-HeroSection'
import { SearchFilters } from './select-location/components/-SearchFilters'
import { HotelGrid } from './select-location/components/-HotelGrid'
import { RatingModal } from './select-location/components/-RatingModal'
import { ComplaintModal } from './select-location/components/-ComplaintModal'
import { normalizeRatingFormValues } from './select-location/components/-ratingFormSchema'
import {
  normalizeComplaintFormValues,
  type ComplaintFormValues,
} from './select-location/components/-complaintFormSchema'
import type { SortOption } from './select-location/components/-helpers'
import type { RatingFormValues } from './select-location/components/-ratingFormSchema'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/select-location')({
  // Main discovery route where users search, filter, and rate hotels.
  component: SelectLocationPage,
})

function SelectLocationPage() {
  // Local UI state for filters, geolocation state, and rating modal flow.
  const { user, isSignedIn } = useUser()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCity, setSelectedCity] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [locationRequested, setLocationRequested] = useState(false)
  const [activeRatingHotelId, setActiveRatingHotelId] =
    useState<Id<'hotels'> | null>(null)
  const [ratingError, setRatingError] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [complaintError, setComplaintError] = useState('')
  const [complaintSaving, setComplaintSaving] = useState(false)
  const [autoOpenHandled, setAutoOpenHandled] = useState(false)

  // Primary data sources for cards and aggregated rating metadata.
  const hotels = useQuery(api.hotels.list, {})
  const cities = useQuery(api.hotels.getCities, {})
  const ratingSummaries = useQuery(
    api.ratings.getSummaries,
    hotels && hotels.length > 0
      ? { hotelIds: hotels.map((hotel) => hotel._id) }
      : 'skip',
  )
  const upsertRating = useMutation(api.ratings.upsertRating)
  const submitComplaint = useMutation(api.complaints.submit)

  const myRating = useQuery(
    api.ratings.getMyRatingForHotel,
    user?.id && activeRatingHotelId ? { hotelId: activeRatingHotelId } : 'skip',
  )

  const myBookings = useQuery(
    api.bookings.getMyBookingsEnriched,
    user?.id ? {} : 'skip',
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

  // Compute hotels with distance
  const hotelsWithDistance = useMemo(() => {
    // Enrich hotels with computed distance when geolocation is available.
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
  const categories = useMemo<Array<string>>(() => {
    if (!hotels) return []
    const values = hotels.flatMap((hotel) =>
      hotel.category ? [hotel.category] : [],
    )
    return [...new Set(values)].sort()
  }, [hotels])

  // Filter and sort hotels
  const filteredHotels = useMemo(() => {
    // Apply search/filter criteria and then sort by selected option.
    const result = hotelsWithDistance.filter((hotel) => {
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
        case 'rating': {
          const ratingA =
            ratingSummaryByHotelId[a._id]?.average ?? a.rating ?? 0
          const ratingB =
            ratingSummaryByHotelId[b._id]?.average ?? b.rating ?? 0
          return ratingB - ratingA // Higher rating first
        }
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

  // Auto-switch to distance sort when location becomes available
  useEffect(() => {
    if (hasUserLocation && sortBy !== 'distance') {
      setSortBy('distance')
    }
  }, [hasUserLocation, sortBy])
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

  const complaintRedirect = '/select-location'

  const complaintBookingOptions = useMemo(() => {
    if (!myBookings) {
      return []
    }

    return myBookings.map(({ booking, hotel }) => ({
      _id: booking._id,
      hotelId: hotel._id,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      status: booking.status,
    }))
  }, [myBookings])

  const openRatingModal = (hotelId: Id<'hotels'>) => {
    // Seed modal state for selected hotel and reset prior errors.
    setActiveRatingHotelId(hotelId)
    setRatingError('')
  }

  const closeRatingModal = () => {
    setActiveRatingHotelId(null)
    setRatingError('')
  }

  const openComplaintModal = () => {
    setShowComplaintModal(true)
    setComplaintError('')
  }

  const closeComplaintModal = () => {
    setShowComplaintModal(false)
    setComplaintError('')
  }

  const handleSubmitRating = async (values: RatingFormValues) => {
    if (!user?.id || !activeRatingHotelId) {
      return
    }

    setRatingSaving(true)
    setRatingError('')

    try {
      const normalizedValues = normalizeRatingFormValues(values)
      await upsertRating({
        hotelId: activeRatingHotelId,
        rating: normalizedValues.rating,
        review: normalizedValues.review,
      })
      closeRatingModal()
    } catch (err) {
      setRatingError(
        err instanceof Error ? err.message : t('rating.saveFailed'),
      )
    } finally {
      setRatingSaving(false)
    }
  }

  const handleSubmitComplaint = async (values: ComplaintFormValues) => {
    if (!user?.id) {
      return
    }

    setComplaintSaving(true)
    setComplaintError('')

    try {
      const normalizedValues = normalizeComplaintFormValues(values)

      await submitComplaint({
        hotelId: normalizedValues.hotelId as Id<'hotels'>,
        subject: normalizedValues.subject,
        description: normalizedValues.description,
        bookingId: normalizedValues.bookingId
          ? (normalizedValues.bookingId as Id<'bookings'>)
          : undefined,
      })

      closeComplaintModal()
    } catch (err) {
      setComplaintError(
        err instanceof Error ? err.message : t('complaint.submitFailed'),
      )
    } finally {
      setComplaintSaving(false)
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
        locationSupported={locationSupported}
        locationLoading={locationLoading}
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

      <button
        type="button"
        onClick={openComplaintModal}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 px-4 py-3 bg-blue-500 text-slate-900 font-semibold rounded-full shadow-lg shadow-blue-500/30 hover:bg-blue-400 transition-all"
        aria-label={t('complaint.fab')}
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="hidden sm:inline">{t('complaint.fab')}</span>
      </button>

      {activeRatingHotelId && (
        <RatingModal
          isSignedIn={Boolean(isSignedIn)}
          hotelName={activeHotel?.name || ''}
          hasExistingRating={Boolean(hasExistingRating)}
          initialRatingValue={myRating?.rating ?? 0}
          initialRatingText={myRating?.review ?? ''}
          ratingError={ratingError}
          ratingSaving={ratingSaving}
          ratingRedirect={ratingRedirect}
          onClose={closeRatingModal}
          onSubmit={handleSubmitRating}
        />
      )}

      {showComplaintModal && (
        <ComplaintModal
          isSignedIn={Boolean(isSignedIn)}
          hotels={
            hotels?.map((hotel) => ({
              _id: hotel._id,
              name: hotel.name,
              city: hotel.city,
              country: hotel.country,
            })) ?? []
          }
          bookings={complaintBookingOptions}
          complaintError={complaintError}
          complaintSaving={complaintSaving}
          complaintRedirect={complaintRedirect}
          onClose={closeComplaintModal}
          onSubmit={handleSubmitComplaint}
        />
      )}
    </div>
  )
}
