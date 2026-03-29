import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { Calendar, Car, Star, Tag } from 'lucide-react'
import { useState } from 'react'

import { api } from '../../convex/_generated/api'
import { useI18n } from '../lib/i18n'
import { getHotelCategoryLabel } from '../lib/hotelCategories'
import { DEFAULT_SELECT_LOCATION_SEARCH } from '../lib/navigationSearch'
import { BookingModal } from './hotels.$hotelId/components/-BookingModal'
import { HotelAnnouncementsPreview } from './hotels.$hotelId/components/-HotelAnnouncementsPreview'
import { HotelDateSelection } from './hotels.$hotelId/components/-HotelDateSelection'
import { HotelPageChrome } from './hotels.$hotelId/components/-HotelPageChrome'
import { HotelRoomsGrid } from './hotels.$hotelId/components/-HotelRoomsGrid'
import { useHotelBookingState } from './hotels.$hotelId/components/-useHotelBookingState'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/hotels/$hotelId')({
  validateSearch: (search: Record<string, unknown>) => ({
    resumeBookingId:
      typeof search.resumeBookingId === 'string' && search.resumeBookingId
        ? search.resumeBookingId
        : undefined,
  }),
  component: HotelDetailPage,
})

function getHotelCategoryBadgeClass(category: string): string {
  switch (category) {
    case 'Luxury':
      return 'bg-violet-500/20 text-violet-600 dark:text-violet-400'
    case 'Boutique':
      return 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
    case 'Resort and Spa':
      return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
    case 'Suite':
      return 'bg-violet-500/20 text-violet-600 dark:text-violet-400'
    case 'Extended-Stay':
      return 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
    case 'Budget':
      return 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
    default:
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
  }
}

function HotelDetailPage() {
  const { hotelId } = Route.useParams()
  const search = Route.useSearch()
  const { user, isSignedIn } = useUser()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [dateValidationError, setDateValidationError] = useState(false)

  const hotel = useQuery(api.hotels.get, {
    hotelId: hotelId as Id<'hotels'>,
  })
  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')
  const announcements = useQuery(
    api.announcements.getActiveAnnouncementsForHotel,
    { hotelId: hotelId as Id<'hotels'> },
  )
  const resumeBooking = useQuery(
    api.bookings.get,
    search.resumeBookingId
      ? { bookingId: search.resumeBookingId as Id<'bookings'> }
      : 'skip',
  )

  const {
    closeBookingModal,
    nights,
    selectedDates,
    setSelectedDates,
    setShowBookingModal,
    showBookingModal,
  } = useHotelBookingState({
    hasResumeBookingSearch: Boolean(search.resumeBookingId),
    onClearResumeBooking: () =>
      navigate({
        params: { hotelId },
        replace: true,
        search: (prev) => ({ ...prev, resumeBookingId: undefined }),
        to: '/hotels/$hotelId',
      }),
    resumeBooking,
  })

  const availableRooms = useQuery(
    api.rooms.getAvailableRooms,
    selectedDates.checkIn && selectedDates.checkOut
      ? {
          checkIn: selectedDates.checkIn,
          checkOut: selectedDates.checkOut,
          hotelId: hotelId as Id<'hotels'>,
        }
      : 'skip',
  )
  const allRooms = useQuery(api.rooms.getByHotel, {
    hotelId: hotelId as Id<'hotels'>,
    status: 'available',
  })

  const rooms =
    selectedDates.checkIn && selectedDates.checkOut ? availableRooms : allRooms
  const redirectTarget = `/hotels/${hotelId}`

  if (hotel === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500"></div>
      </div>
    )
  }

  if (hotel === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="max-w-md rounded-2xl border border-slate-800/50 bg-slate-900/50 p-12 text-center">
          <h2 className="mb-2 text-xl font-semibold text-slate-300">
            {t('hotel.notFoundTitle')}
          </h2>
          <p className="mb-6 text-slate-500">
            {t('hotel.notFoundDescription')}
          </p>
          <Link
            to="/select-location"
            search={DEFAULT_SELECT_LOCATION_SEARCH}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            {t('hotel.backToHotels')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <HotelPageChrome
        isSignedIn={Boolean(isSignedIn)}
        userFirstName={user?.firstName ?? undefined}
      />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-100">
                  {hotel.name}
                </h1>
                {hotel.rating !== undefined && (
                  <div className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium text-slate-200">
                      {hotel.rating.toFixed(1)}
                    </span>
                  </div>
                )}
                {hotel.category && (
                  <span
                    className={`rounded-lg px-2 py-1 text-xs font-medium ${getHotelCategoryBadgeClass(
                      hotel.category,
                    )}`}
                  >
                    {getHotelCategoryLabel(hotel.category, t)}
                  </span>
                )}
              </div>

              <p className="mb-2 text-slate-400">{hotel.address}</p>
              <p className="text-slate-500">
                {hotel.city}
                {hotel.stateProvince ? `, ${hotel.stateProvince}` : ''}
                {hotel.postalCode ? ` ${hotel.postalCode}` : ''},{' '}
                {hotel.country}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {hotel.parkingIncluded && (
                  <div className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                    <Car className="h-3 w-3" />
                    {t('hotel.freeParking')}
                  </div>
                )}
                {hotel.lastRenovationDate && (
                  <div className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-400">
                    <Calendar className="h-3 w-3" />
                    {t('hotel.renovated', {
                      year: hotel.lastRenovationDate.split('-')[0],
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <HotelAnnouncementsPreview
          announcements={
            announcements?.map((announcement) => ({
              _id: announcement._id,
              body: announcement.body,
              priority: announcement.priority as
                | 'normal'
                | 'important'
                | 'urgent',
              title: announcement.title,
            })) ?? []
          }
          hotelId={hotelId}
        />

        <HotelDateSelection
          checkIn={selectedDates.checkIn}
          checkOut={selectedDates.checkOut}
          nights={nights}
          onCheckInChange={(checkIn) => {
            setDateValidationError(false)
            setSelectedDates((current) => ({ ...current, checkIn }))
          }}
          onCheckOutChange={(checkOut) => {
            setDateValidationError(false)
            setSelectedDates((current) => ({ ...current, checkOut }))
          }}
        />

        {dateValidationError && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {t('hotel.selectDatesFirst')}
          </div>
        )}

        <HotelRoomsGrid
          isSignedIn={Boolean(isSignedIn)}
          nights={nights}
          onBookRoom={(roomId) => {
            if (!selectedDates.checkIn || !selectedDates.checkOut) {
              setDateValidationError(true)
              return
            }

            if (!isSignedIn) {
              navigate({
                search: { redirect: redirectTarget },
                to: '/sign-in',
              })
              return
            }

            setShowBookingModal(roomId)
          }}
          rooms={rooms}
          selectedDates={selectedDates}
        />

        {(hotel.description || (hotel.tags && hotel.tags.length > 0)) && (
          <div className="mt-8 rounded-2xl border border-slate-800/50 bg-slate-900/40 p-5">
            {hotel.description && (
              <p className="text-sm leading-relaxed text-slate-400">
                {hotel.description}
              </p>
            )}

            {hotel.tags && hotel.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {hotel.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-400"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {showBookingModal && isSignedIn && profile && (
        <BookingModal
          roomId={showBookingModal}
          hotelId={hotelId as Id<'hotels'>}
          checkIn={selectedDates.checkIn}
          checkOut={selectedDates.checkOut}
          nights={nights}
          existingBooking={
            resumeBooking &&
            ['held', 'pending_payment'].includes(resumeBooking.status)
              ? resumeBooking
              : undefined
          }
          onClose={closeBookingModal}
          onSuccess={() => {
            setShowBookingModal(null)
            navigate({ to: '/bookings' })
          }}
        />
      )}
    </div>
  )
}
