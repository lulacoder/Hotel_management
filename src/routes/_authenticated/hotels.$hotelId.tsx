import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useUser, UserButton } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
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
} from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/hotels/$hotelId')({
  component: HotelDetailPage,
})

function HotelDetailPage() {
  const { hotelId } = Route.useParams()
  const { user } = useUser()
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

  const roomTypeLabels = {
    single: 'Single Room',
    double: 'Double Room',
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
            <Link
              to="/bookings"
              className="text-slate-400 hover:text-amber-400 transition-colors font-medium"
            >
              My Bookings
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hotel Header */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-slate-100">
                  {hotel.name}
                </h1>
                <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm text-slate-200 font-medium">
                    4.8
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <MapPin className="w-4 h-4" />
                <span>{hotel.address}</span>
              </div>
              <p className="text-slate-500">
                {hotel.city}, {hotel.country}
              </p>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">
            Select Dates
          </h2>
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
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
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
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
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
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-400">
                        ${(room.basePrice / 100).toFixed(0)}
                      </p>
                      <p className="text-sm text-slate-500">per night</p>
                    </div>
                  </div>

                  {/* Room Details */}
                  <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>Up to {room.maxOccupancy}</span>
                    </div>
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
                      setShowBookingModal(room._id)
                    }}
                    disabled={!selectedDates.checkIn || !selectedDates.checkOut}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedDates.checkIn && selectedDates.checkOut
                      ? 'Book Now'
                      : 'Select Dates to Book'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Booking Modal */}
      {showBookingModal && profile && (
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

// Booking Modal
function BookingModal({
  roomId,
  hotelId,
  checkIn,
  checkOut,
  nights,
  onClose,
  onSuccess,
}: {
  roomId: Id<'rooms'>
  hotelId: Id<'hotels'>
  checkIn: string
  checkOut: string
  nights: number
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useUser()
  const room = useQuery(api.rooms.get, { roomId })
  const hotel = useQuery(api.hotels.get, { hotelId })
  const holdRoom = useMutation(api.bookings.holdRoom)
  const confirmBooking = useMutation(api.bookings.confirmBooking)

  const [step, setStep] = useState<'details' | 'confirm'>('details')
  const [guestDetails, setGuestDetails] = useState({
    guestName: user?.fullName || '',
    guestEmail: user?.emailAddresses[0]?.emailAddress || '',
    specialRequests: '',
  })
  const [bookingId, setBookingId] = useState<Id<'bookings'> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleHold = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      const id = await holdRoom({
        clerkUserId: user.id,
        roomId,
        checkIn,
        checkOut,
        guestName: guestDetails.guestName,
        guestEmail: guestDetails.guestEmail,
        specialRequests: guestDetails.specialRequests || undefined,
      })
      setBookingId(id)
      setStep('confirm')
    } catch (err: any) {
      setError(err.message || 'Failed to hold room')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!user?.id || !bookingId) return

    setLoading(true)
    setError('')

    try {
      await confirmBooking({
        clerkUserId: user.id,
        bookingId,
      })
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to confirm booking')
    } finally {
      setLoading(false)
    }
  }

  if (!room || !hotel) {
    return null
  }

  const totalPrice = (room.basePrice * nights) / 100

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">
            {step === 'details'
              ? 'Complete Your Booking'
              : 'Confirm Reservation'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {step === 'details'
              ? 'Enter your details to hold this room'
              : 'Review and confirm your booking'}
          </p>
        </div>

        <div className="p-6">
          {/* Booking Summary */}
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-200">{hotel.name}</p>
                <p className="text-sm text-slate-400">
                  Room {room.roomNumber} - {room.type}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Check-in</p>
                <p className="text-slate-200">{checkIn}</p>
              </div>
              <div>
                <p className="text-slate-500">Check-out</p>
                <p className="text-slate-200">{checkOut}</p>
              </div>
            </div>
            <div className="border-t border-slate-700 mt-4 pt-4 flex justify-between">
              <span className="text-slate-400">
                {nights} night{nights !== 1 ? 's' : ''} @ $
                {(room.basePrice / 100).toFixed(0)}/night
              </span>
              <span className="text-xl font-bold text-amber-400">
                ${totalPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {step === 'details' ? (
            <form onSubmit={handleHold} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Guest Name
                </label>
                <input
                  type="text"
                  required
                  value={guestDetails.guestName}
                  onChange={(e) =>
                    setGuestDetails({
                      ...guestDetails,
                      guestName: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={guestDetails.guestEmail}
                  onChange={(e) =>
                    setGuestDetails({
                      ...guestDetails,
                      guestEmail: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Special Requests (optional)
                </label>
                <textarea
                  rows={3}
                  value={guestDetails.specialRequests}
                  onChange={(e) =>
                    setGuestDetails({
                      ...guestDetails,
                      specialRequests: e.target.value,
                    })
                  }
                  placeholder="Any special requests..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all resize-none"
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-400 text-sm">
                  <strong>Note:</strong> Your room will be held for 15 minutes.
                  Please confirm your booking to complete the reservation.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50"
                >
                  {loading ? 'Holding...' : 'Hold Room'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Room Held Successfully!</span>
                </div>
                <p className="text-slate-400 text-sm">
                  Your room is being held. Please confirm within 15 minutes to
                  complete your reservation.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  Cancel Hold
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50"
                >
                  {loading ? 'Confirming...' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
