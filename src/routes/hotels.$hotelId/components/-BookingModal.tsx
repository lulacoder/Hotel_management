import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { Building2, CheckCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { Id } from '../../../../convex/_generated/dataModel'

interface BookingModalProps {
  roomId: Id<'rooms'>
  hotelId: Id<'hotels'>
  checkIn: string
  checkOut: string
  nights: number
  onClose: () => void
  onSuccess: () => void
}

export function BookingModal({
  roomId,
  hotelId,
  checkIn,
  checkOut,
  nights,
  onClose,
  onSuccess,
}: BookingModalProps) {
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

  useEffect(() => {
    if (!user) return

    setGuestDetails((prev) => ({
      ...prev,
      guestName: prev.guestName || user.fullName || '',
      guestEmail:
        prev.guestEmail || user.emailAddresses[0]?.emailAddress || '',
    }))
  }, [user])

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
