import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useUser, UserButton } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import {
  ArrowLeft,
  MapPin,
  Building2,
  Users,
  CheckCircle,
  Star,
  Wifi,
  Tv,
  Wind,
  Coffee,
  Car,
  Tag,
  Calendar,
  Cigarette,
  CigaretteOff,
  Bed,
} from 'lucide-react'
import { useState } from 'react'

import { BookingModal } from './hotels.$hotelId/components/-BookingModal'
import { ThemeToggle } from '../components/ThemeToggle'

export const Route = createFileRoute('/hotels/$hotelId')({
  component: HotelDetailPage,
})

function HotelDetailPage() {
  const { hotelId } = Route.useParams()
  const { user, isSignedIn } = useUser()
  const navigate = useNavigate()
  const [selectedDates, setSelectedDates] = useState({
    checkIn: '',
    checkOut: '',
  })
  const [showBookingModal, setShowBookingModal] = useState<Id<'rooms'> | null>(
    null,
  )

  const hotel = useQuery(api.hotels.get, { hotelId: hotelId as Id<'hotels'> })

  // Get available rooms if dates are selected
  const availableRooms = useQuery(
    api.rooms.getAvailableRooms,
    selectedDates.checkIn && selectedDates.checkOut
      ? {
          hotelId: hotelId as Id<'hotels'>,
          checkIn: selectedDates.checkIn,
          checkOut: selectedDates.checkOut,
        }
      : 'skip',
  )

  // Get all rooms if no dates selected
  const allRooms = useQuery(api.rooms.getByHotel, {
    hotelId: hotelId as Id<'hotels'>,
    status: 'available',
  })

  const rooms =
    selectedDates.checkIn && selectedDates.checkOut ? availableRooms : allRooms

  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  const roomTypeLabels: Record<string, string> = {
    budget: 'Budget Room',
    standard: 'Standard Room',
    suite: 'Suite',
    deluxe: 'Deluxe Room',
  }

  const amenityIcons: Record<string, typeof Wifi> = {
    WiFi: Wifi,
    TV: Tv,
    'Air Conditioning': Wind,
    'Mini Bar': Coffee,
  }

  // Calculate number of nights
  const calculateNights = () => {
    if (!selectedDates.checkIn || !selectedDates.checkOut) return 0
    const checkIn = new Date(selectedDates.checkIn)
    const checkOut = new Date(selectedDates.checkOut)
    const diff = checkOut.getTime() - checkIn.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const nights = calculateNights()
  const redirectTarget = `/hotels/${hotelId}`

  if (hotel === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500/20 border-t-amber-500"></div>
      </div>
    )
  }

  if (hotel === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center max-w-md">
          <h2 className="text-xl font-semibold text-slate-300 mb-2">
            Hotel not found
          </h2>
          <p className="text-slate-500 mb-6">
            This hotel may have been removed.
          </p>
          <Link
            to="/select-location"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Hotels
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link
            to="/select-location"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Hotels
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle compact />
            {isSignedIn ? (
              <>
                <Link
                  to="/bookings"
                  className="px-3 py-1.5 text-sm font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
                >
                  My Bookings
                </Link>
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

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hotel Header */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-bold text-slate-100">
                  {hotel.name}
                </h1>
                {hotel.rating && (
                  <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm text-slate-200 font-medium">
                      {hotel.rating.toFixed(1)}
                    </span>
                  </div>
                )}
                {hotel.category && (
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      hotel.category === 'Luxury'
                        ? 'bg-amber-500/20 text-amber-400'
                        : hotel.category === 'Boutique'
                          ? 'bg-purple-500/20 text-purple-400'
                          : hotel.category === 'Resort and Spa'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : hotel.category === 'Suite'
                              ? 'bg-blue-500/20 text-blue-400'
                              : hotel.category === 'Extended-Stay'
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {hotel.category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <MapPin className="w-4 h-4" />
                <span>{hotel.address}</span>
              </div>
              <p className="text-slate-500 mb-3">
                {hotel.city}
                {hotel.stateProvince ? `, ${hotel.stateProvince}` : ''}
                {hotel.postalCode ? ` ${hotel.postalCode}` : ''},{' '}
                {hotel.country}
              </p>

              {/* Hotel Description */}
              {hotel.description && (
                <p className="text-slate-400 text-sm mb-4 max-w-2xl">
                  {hotel.description}
                </p>
              )}

              {/* Hotel Features */}
              <div className="flex flex-wrap gap-2 mb-4">
                {hotel.parkingIncluded && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs">
                    <Car className="w-3 h-3" />
                    Free Parking
                  </div>
                )}
                {hotel.lastRenovationDate && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded-lg text-slate-400 text-xs">
                    <Calendar className="w-3 h-3" />
                    Renovated {hotel.lastRenovationDate.split('-')[0]}
                  </div>
                )}
              </div>

              {/* Tags */}
              {hotel.tags && hotel.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {hotel.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-xs text-slate-400"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">
            Select Dates
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Pick your check-in and check-out dates to see available rooms.
          </p>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm text-slate-400 mb-2">
                Check-in
              </label>
              <input
                type="date"
                value={selectedDates.checkIn}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) =>
                  setSelectedDates({
                    ...selectedDates,
                    checkIn: e.target.value,
                  })
                }
                className="hotel-date-input w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-slate-400 mb-2">
                Check-out
              </label>
              <input
                type="date"
                value={selectedDates.checkOut}
                min={
                  selectedDates.checkIn ||
                  new Date().toISOString().split('T')[0]
                }
                onChange={(e) =>
                  setSelectedDates({
                    ...selectedDates,
                    checkOut: e.target.value,
                  })
                }
                className="hotel-date-input w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
            {nights > 0 && (
              <div className="flex items-end">
                <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <span className="text-amber-400 font-semibold">
                    {nights} night{nights !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rooms Grid */}
        <h2 className="text-xl font-semibold text-slate-200 mb-4">
          {selectedDates.checkIn && selectedDates.checkOut
            ? 'Available Rooms'
            : 'All Rooms'}
        </h2>

        {rooms === undefined ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/20 border-t-amber-500"></div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              No rooms available
            </h3>
            <p className="text-slate-500">
              {selectedDates.checkIn && selectedDates.checkOut
                ? 'Try selecting different dates.'
                : 'This hotel has no available rooms.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rooms.map((room) => (
              <div
                key={room._id}
                className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden hover:border-slate-700/50 transition-all"
              >
                {/* Room Image Placeholder */}
                <div className="h-40 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <Building2 className="w-12 h-12 text-slate-700" />
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-200">
                        Room {room.roomNumber}
                      </h3>
                      <p className="text-slate-400">
                        {roomTypeLabels[room.type]}
                      </p>
                      {/* Room Description */}
                      {room.description && (
                        <p className="text-slate-500 text-sm mt-1">
                          {room.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-400">
                        ${(room.basePrice / 100).toFixed(0)}
                      </p>
                      <p className="text-sm text-slate-500">per night</p>
                    </div>
                  </div>

                  {/* Room Details */}
                  <div className="flex items-center gap-4 text-sm text-slate-400 mb-4 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>Up to {room.maxOccupancy}</span>
                    </div>
                    {room.bedOptions && (
                      <div className="flex items-center gap-1">
                        <Bed className="w-4 h-4" />
                        <span>{room.bedOptions}</span>
                      </div>
                    )}
                    {room.smokingAllowed !== undefined && (
                      <div className="flex items-center gap-1">
                        {room.smokingAllowed ? (
                          <>
                            <Cigarette className="w-4 h-4 text-amber-500" />
                            <span className="text-amber-500">Smoking</span>
                          </>
                        ) : (
                          <>
                            <CigaretteOff className="w-4 h-4 text-emerald-500" />
                            <span className="text-emerald-500">
                              Non-smoking
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Amenities */}
                  {room.amenities && room.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {room.amenities.slice(0, 4).map((amenity) => {
                        const Icon = amenityIcons[amenity] || CheckCircle
                        return (
                          <div
                            key={amenity}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-xs text-slate-400"
                          >
                            <Icon className="w-3 h-3" />
                            {amenity}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Total Price */}
                  {nights > 0 && (
                    <div className="bg-slate-800/50 rounded-xl p-3 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">
                          ${(room.basePrice / 100).toFixed(0)} x {nights} nights
                        </span>
                        <span className="text-slate-200 font-semibold">
                          ${((room.basePrice * nights) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Book Button */}
                  <button
                    onClick={() => {
                      if (!selectedDates.checkIn || !selectedDates.checkOut) {
                        alert(
                          'Please select check-in and check-out dates first',
                        )
                        return
                      }
                      if (!isSignedIn) {
                        navigate({
                          to: '/sign-in',
                          search: { redirect: redirectTarget },
                        })
                        return
                      }
                      setShowBookingModal(room._id)
                    }}
                    disabled={!selectedDates.checkIn || !selectedDates.checkOut}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedDates.checkIn && selectedDates.checkOut
                      ? isSignedIn
                        ? 'Book Now'
                        : 'Sign In to Book'
                      : 'Select Dates to Book'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Booking Modal */}
      {showBookingModal && isSignedIn && profile && (
        <BookingModal
          roomId={showBookingModal}
          hotelId={hotelId as Id<'hotels'>}
          checkIn={selectedDates.checkIn}
          checkOut={selectedDates.checkOut}
          nights={nights}
          onClose={() => setShowBookingModal(null)}
          onSuccess={() => {
            setShowBookingModal(null)
            navigate({ to: '/bookings' })
          }}
        />
      )}
    </div>
  )
}
