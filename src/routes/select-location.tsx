// Hotel discovery route with geolocation, search filters, sorting, and rating workflow.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'

import { api } from '../../convex/_generated/api'
import { useGeolocation } from '../hooks/useGeolocation'
import { calculateDistance } from '../lib/distance'
import { useI18n } from '../lib/i18n/provider'
import { DEFAULT_SELECT_LOCATION_SEARCH } from '../lib/navigationSearch'
import { Seo } from '../components/Seo'
import { Footer } from '../components/Footer'
import { SelectLocationHeader } from './select-location/components/-SelectLocationHeader'
import { HeroSection } from './select-location/components/-HeroSection'
import { SearchFilters } from './select-location/components/-SearchFilters'
import { HotelGrid } from './select-location/components/-HotelGrid'
import { RatingModal } from './select-location/components/-RatingModal'
import { ComplaintModal } from './select-location/components/-ComplaintModal'
import {
  normalizeFilterValue,
  normalizeSearchTerm,
  normalizeSortOption,
} from './select-location/components/-helpers'
import type { ComplaintFormValues } from './select-location/components/-ComplaintModal'
import type { SortOption } from './select-location/components/-helpers'
import type { RatingFormValues } from './select-location/components/-RatingModal'
import type { Id } from '../../convex/_generated/dataModel'
import {
  useMutation,
  usePaginatedQuery,
  useQuery,
} from '@/integrations/convex/hooks'

type HotelCategory =
  | 'Boutique'
  | 'Budget'
  | 'Luxury'
  | 'Resort and Spa'
  | 'Extended-Stay'
  | 'Suite'

function isHotelCategory(value: string): value is HotelCategory {
  return [
    'Boutique',
    'Budget',
    'Luxury',
    'Resort and Spa',
    'Extended-Stay',
    'Suite',
  ].includes(value)
}

export const Route = createFileRoute('/select-location')({
  validateSearch: (search: Record<string, unknown>) => ({
    category: normalizeFilterValue(search.category),
    checkIn: typeof search.checkIn === 'string' ? search.checkIn : '',
    checkOut: typeof search.checkOut === 'string' ? search.checkOut : '',
    city: normalizeFilterValue(search.city),
    guests:
      typeof search.guests === 'number' &&
      Number.isInteger(search.guests) &&
      search.guests >= 1 &&
      search.guests <= 20
        ? search.guests
        : 1,
    q: normalizeSearchTerm(search.q),
    rate: typeof search.rate === 'string' ? search.rate : undefined,
    sort: normalizeSortOption(search.sort),
  }),
  // Main discovery route where users search, filter, and rate hotels.
  component: SelectLocationPage,
})

function SelectLocationPage() {
  // Local UI state for filters, geolocation state, and rating modal flow.
  const { user, isSignedIn } = useUser()
  const search = Route.useSearch()
  const { t } = useI18n()
  const navigate = useNavigate()
  const locationRequestedRef = useRef(false)
  const autoSelectedDistanceRef = useRef(false)
  const [selectedRatingHotelId, setSelectedRatingHotelId] =
    useState<Id<'hotels'> | null>(null)
  const [ratingError, setRatingError] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [complaintError, setComplaintError] = useState('')
  const [complaintSaving, setComplaintSaving] = useState(false)

  const searchTerm = search.q
  const selectedCity = search.city
  const selectedCategory = search.category
  const sortBy = search.sort
  const hasValidStay =
    /^\d{4}-\d{2}-\d{2}$/.test(search.checkIn) &&
    /^\d{4}-\d{2}-\d{2}$/.test(search.checkOut) &&
    search.checkOut > search.checkIn

  // Primary data sources for cards and aggregated rating metadata.
  const hotels = useQuery(api.hotels.list, {})
  const availabilityResults = useQuery(
    api.hotels.searchAvailable,
    hasValidStay
      ? {
          category: isHotelCategory(selectedCategory)
            ? selectedCategory
            : undefined,
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          city: selectedCity !== 'all' ? selectedCity : undefined,
          destination: searchTerm.trim() || undefined,
          guests: search.guests,
        }
      : 'skip',
  )
  const ratingHotelIdFromSearch = useMemo<Id<'hotels'> | null>(() => {
    if (!hotels || !search.rate) {
      return null
    }

    const matchedHotel = hotels.find((hotel) => hotel._id === search.rate)
    return matchedHotel?._id ?? null
  }, [hotels, search.rate])
  const activeRatingHotelId = selectedRatingHotelId ?? ratingHotelIdFromSearch

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

  const myBookingsPage = usePaginatedQuery(
    api.bookings.getMyBookingsEnriched,
    user?.id && showComplaintModal ? {} : 'skip',
    { initialNumItems: 50 },
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
    if (locationSupported && !locationRequestedRef.current) {
      locationRequestedRef.current = true
      requestLocation()
    }
  }, [locationSupported, requestLocation])

  // Compute hotels with distance
  const hotelsWithDistance = useMemo(() => {
    // Enrich hotels with computed distance when geolocation is available.
    const sourceHotels = hasValidStay
      ? availabilityResults?.map((result) => ({
          ...result.hotel,
          fromPrice: result.fromPrice,
          matchingRoomCount: result.matchingRoomCount,
        }))
      : hotels
    if (!sourceHotels) return []

    return sourceHotels.map((hotel) => {
      let distance: number | null = null

      if (userLat !== null && userLng !== null && hotel.location) {
        distance = calculateDistance(
          userLat,
          userLng,
          hotel.location.lat,
          hotel.location.lng,
        )
      }

      return { ...hotel, distance }
    })
  }, [availabilityResults, hasValidStay, hotels, userLat, userLng])

  const ratingSummaryByHotelId = useMemo(() => {
    const map: Partial<Record<string, { average: number; count: number }>> = {}

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

  const cities = useMemo<Array<string>>(() => {
    if (!hotels) return []
    const values = hotels.flatMap((hotel) => (hotel.city ? [hotel.city] : []))
    return Array.from(new Set(values)).sort()
  }, [hotels])

  // Get unique categories
  const categories = useMemo<Array<string>>(() => {
    if (!hotels) return []
    const values = hotels.flatMap((hotel) =>
      hotel.category ? [hotel.category] : [],
    )
    return Array.from(new Set(values)).sort()
  }, [hotels])

  // Filter and sort hotels
  const filteredHotels = useMemo(() => {
    // Apply search/filter criteria and then sort by selected option.
    const needle = hasValidStay ? '' : searchTerm.toLowerCase()
    const result = hotelsWithDistance.filter((hotel) => {
      const matchesSearch =
        needle.length === 0 ||
        hotel.name.toLowerCase().includes(needle) ||
        hotel.city.toLowerCase().includes(needle) ||
        hotel.country.toLowerCase().includes(needle) ||
        (hotel.description?.toLowerCase().includes(needle) ?? false) ||
        (hotel.tags?.some((tag) => tag.toLowerCase().includes(needle)) ?? false)
      const matchesCity = selectedCity === 'all' || hotel.city === selectedCity
      const matchesCategory =
        selectedCategory === 'all' || hotel.category === selectedCategory
      return matchesSearch && matchesCity && matchesCategory
    })

    return result.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          // Hotels without location go to the end
          if (a.distance === null && b.distance === null) return 0
          if (a.distance === null) return 1
          if (b.distance === null) return -1
          return a.distance - b.distance
        case 'rating': {
          const ratingA =
            ratingSummaryByHotelId[a._id]?.average ??
            (a.rating !== undefined ? a.rating : 0)
          const ratingB =
            ratingSummaryByHotelId[b._id]?.average ??
            (b.rating !== undefined ? b.rating : 0)
          return ratingB - ratingA // Higher rating first
        }
        case 'name':
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [
    hotelsWithDistance,
    searchTerm,
    selectedCity,
    selectedCategory,
    sortBy,
    ratingSummaryByHotelId,
    hasValidStay,
  ])

  const hasUserLocation = userLat !== null && userLng !== null

  // Auto-switch once when browser location first becomes available, while
  // preserving later user-selected sort changes.
  useEffect(() => {
    if (!hasUserLocation || autoSelectedDistanceRef.current) {
      return
    }

    autoSelectedDistanceRef.current = true

    if (sortBy !== 'name') {
      return
    }

    navigate({
      replace: true,
      search: (prev) => ({
        ...DEFAULT_SELECT_LOCATION_SEARCH,
        ...prev,
        sort: 'distance',
      }),
      to: '/select-location',
    })
  }, [hasUserLocation, navigate, sortBy])

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
    if (!showComplaintModal || myBookingsPage.status === 'LoadingFirstPage') {
      return []
    }

    return myBookingsPage.results.map(({ booking, hotel }) => ({
      _id: booking._id,
      hotelId: hotel._id,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      status: booking.status,
    }))
  }, [myBookingsPage.results, myBookingsPage.status, showComplaintModal])

  const updateSearch = (
    nextSearch: Partial<{
      category: string
      checkIn: string
      checkOut: string
      city: string
      guests: number
      q: string
      sort: SortOption
    }>,
  ) => {
    navigate({
      replace: true,
      search: (prev) => ({
        ...DEFAULT_SELECT_LOCATION_SEARCH,
        ...prev,
        ...nextSearch,
      }),
      to: '/select-location',
    })
  }

  const openRatingModal = (hotelId: Id<'hotels'>) => {
    // Seed modal state for selected hotel and reset prior errors.
    setSelectedRatingHotelId(hotelId)
    setRatingError('')
  }

  const closeRatingModal = () => {
    setSelectedRatingHotelId(null)
    setRatingError('')

    if (search.rate) {
      navigate({
        replace: true,
        search: (prev) => ({
          ...DEFAULT_SELECT_LOCATION_SEARCH,
          ...prev,
          rate: undefined,
        }),
        to: '/select-location',
      })
    }
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
      await upsertRating({
        hotelId: activeRatingHotelId,
        rating: values.rating,
        review: values.review.trim() || undefined,
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
      await submitComplaint({
        hotelId: values.hotelId as Id<'hotels'>,
        subject: values.subject.trim(),
        description: values.description.trim(),
        bookingId: values.bookingId.trim()
          ? (values.bookingId.trim() as Id<'bookings'>)
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

  // Dynamic SEO title & structured data
  const seoTitle = useMemo(() => {
    if (selectedCity && selectedCity !== 'all') {
      return `Hotels in ${selectedCity} | Browse Stays`
    }
    if (selectedCategory && selectedCategory !== 'all') {
      return `${selectedCategory} Hotels & Suites`
    }
    if (searchTerm) {
      return `"${searchTerm}" Hotels & Destinations`
    }
    return 'Browse Luxury Hotels & Resorts'
  }, [selectedCity, selectedCategory, searchTerm])

  const selectLocationJsonLd = useMemo(() => {
    const itemListElements = filteredHotels.slice(0, 10).map((hotel, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: hotel.name,
      url: `https://tripways.com/hotels/${hotel._id}`,
    }))

    return [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://tripways.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Browse Hotels',
            item: 'https://tripways.com/select-location',
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: seoTitle,
        itemListElement: itemListElements,
      },
    ]
  }, [filteredHotels, seoTitle])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <Seo
        title={seoTitle}
        description="Explore and compare available luxury and boutique hotels across top destinations with verified guest ratings, real-time availability, and instant booking."
        canonicalUrl="/select-location"
        jsonLd={selectLocationJsonLd}
      />
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
        onSearchTermChange={(value) => updateSearch({ q: value })}
        checkIn={search.checkIn}
        checkOut={search.checkOut}
        guests={search.guests}
        hasValidStay={hasValidStay}
        onCheckInChange={(value) => updateSearch({ checkIn: value })}
        onCheckOutChange={(value) => updateSearch({ checkOut: value })}
        onGuestsChange={(value) => updateSearch({ guests: value })}
      >
        <SearchFilters
          selectedCity={selectedCity}
          onCityChange={(value) => updateSearch({ city: value })}
          cities={cities}
          selectedCategory={selectedCategory}
          onCategoryChange={(value) => updateSearch({ category: value })}
          categories={categories}
          sortBy={sortBy}
          onSortChange={(value) => updateSearch({ sort: value })}
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
          isLoading={
            hotels === undefined ||
            (hasValidStay && availabilityResults === undefined)
          }
          checkIn={search.checkIn}
          checkOut={search.checkOut}
          guests={search.guests}
          hasAvailabilitySearch={hasValidStay}
        />
      </main>

      <button
        type="button"
        onClick={openComplaintModal}
        className="fixed bottom-6 right-6 z-40 inline-flex cursor-pointer items-center gap-2 rounded-full border border-violet-500/20 bg-violet-600 px-4 py-3 font-semibold text-white shadow-xl shadow-violet-600/30 transition-all hover:bg-violet-500 hover:shadow-violet-600/40 hover:-translate-y-0.5 active:translate-y-0"
        aria-label={t('complaint.fab')}
      >
        <MessageSquarePlus className="size-5" />
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

      <Footer />
    </div>
  )
}
