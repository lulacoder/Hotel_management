import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Calendar, CheckCircle, Search, UserRound } from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import {
  PACKAGES,
  getPackageByType,
} from '../../../lib/packages'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { PackageType } from '../../../lib/packages'

export const Route = createFileRoute('/admin/walk-in/')({
  component: WalkInBookingPage,
})

type GuestProfileLite = {
  _id: Id<'guestProfiles'>
  name: string
  phone?: string
  email?: string
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

function getNights(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00`)
  const end = new Date(`${checkOut}T00:00:00`)
  const diff = end.getTime() - start.getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function WalkInBookingPage() {
  const { user } = useUser()
  const navigate = useNavigate()

  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  const hotelAssignment = useQuery(
    api.hotelStaff.getByUserId,
    user?.id && profile?._id
      ? { clerkUserId: user.id, userId: profile._id }
      : 'skip',
  )

  const [searchTerm, setSearchTerm] = useState('')
  const [submittedTerm, setSubmittedTerm] = useState('')
  const [selectedGuest, setSelectedGuest] = useState<GuestProfileLite | null>(null)

  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const tomorrow = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }, [])

  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(tomorrow)
  const [selectedRoomId, setSelectedRoomId] = useState<Id<'rooms'> | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<PackageType>('room_only')
  const [specialRequests, setSpecialRequests] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canUseWalkIn =
    hotelAssignment?.role === 'hotel_cashier' ||
    hotelAssignment?.role === 'hotel_admin'

  const searchResults = useQuery(
    (api as any).guestProfiles.search,
    user?.id && submittedTerm.trim().length >= 2
      ? { clerkUserId: user.id, searchTerm: submittedTerm }
      : 'skip',
  ) as
    | Array<{
        profile: GuestProfileLite
        bookingCount: number
      }>
    | undefined

  const availableRooms = useQuery(
    api.rooms.getAvailableRooms,
    hotelAssignment?.hotelId && selectedGuest && checkIn && checkOut
      ? {
          hotelId: hotelAssignment.hotelId,
          checkIn,
          checkOut,
        }
      : 'skip',
  ) as Array<{
    _id: Id<'rooms'>
    roomNumber: string
    type: string
    basePrice: number
  }> | undefined

  const createGuest = useMutation((api as any).guestProfiles.findOrCreate)
  const createWalkInBooking = useMutation((api as any).bookings.walkInBooking)

  const selectedRoom = availableRooms?.find((room) => room._id === selectedRoomId)
  const nights = checkIn && checkOut ? getNights(checkIn, checkOut) : 1

  const roomSubtotal = selectedRoom ? selectedRoom.basePrice * nights : 0
  const packageAddOn = getPackageByType(selectedPackage).addOnPerNight * nights
  const totalPrice = roomSubtotal + packageAddOn

  const handleSearch = () => {
    setSubmittedTerm(searchTerm.trim())
    setSelectedGuest(null)
  }

  const handleCreateOrUseGuest = async () => {
    if (!user?.id) return

    const name = guestName.trim()
    const phone = normalizePhone(guestPhone)
    const email = guestEmail.trim().toLowerCase()

    if (!name) {
      setBookingError('Guest name is required.')
      return
    }

    if (!phone && !email) {
      setBookingError('At least one contact method is required.')
      return
    }

    setBookingError('')

    try {
      const guestProfileId = (await createGuest({
        clerkUserId: user.id,
        name,
        phone: phone || undefined,
        email: email || undefined,
      })) as Id<'guestProfiles'>

      setSelectedGuest({
        _id: guestProfileId,
        name,
        phone: phone || undefined,
        email: email || undefined,
      })
    } catch (error: any) {
      setBookingError(error?.message || 'Failed to create guest profile.')
    }
  }

  const handleConfirmBooking = async () => {
    if (!user?.id || !selectedGuest || !selectedRoom) return

    setSubmitting(true)
    setBookingError('')

    try {
      await createWalkInBooking({
        clerkUserId: user.id,
        guestProfileId: selectedGuest._id,
        roomId: selectedRoom._id,
        checkIn,
        checkOut,
        packageType: selectedPackage,
        packageAddOn: getPackageByType(selectedPackage).addOnPerNight,
        specialRequests: specialRequests.trim() || undefined,
      })

      navigate({ to: '/admin/bookings' })
    } catch (error: any) {
      setBookingError(error?.message || 'Failed to create walk-in booking.')
    } finally {
      setSubmitting(false)
    }
  }

  if (profile === undefined || hotelAssignment === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/20 border-t-amber-500"></div>
      </div>
    )
  }

  if (!canUseWalkIn) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-10 text-center">
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Access denied</h2>
          <p className="text-slate-400">
            Walk-in booking is available for hotel cashiers and hotel admins.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mb-2">
          Walk-in Booking
        </h1>
        <p className="text-slate-400">
          Create an in-person booking: guest lookup, room selection, and confirm.
        </p>
      </div>

      {bookingError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {bookingError}
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-slate-100">Step 1 — Guest Lookup</h2>
        </div>

        <div className="flex gap-3 mb-4">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by phone or email"
            className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="px-4 py-3 bg-slate-800 text-slate-200 rounded-xl border border-slate-700 hover:bg-slate-700"
          >
            Search
          </button>
        </div>

        {searchResults && searchResults.length > 0 && (
          <div className="space-y-2 mb-4">
            {searchResults.map((item) => (
              <button
                key={item.profile._id}
                type="button"
                onClick={() => {
                  setSelectedGuest(item.profile)
                  setBookingError('')
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedGuest?._id === item.profile._id
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <p className="text-slate-100 font-medium">{item.profile.name}</p>
                <p className="text-slate-400 text-sm">
                  {item.profile.phone || 'No phone'} · {item.profile.email || 'No email'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Past bookings: {item.bookingCount}
                </p>
              </button>
            ))}
          </div>
        )}

        {!selectedGuest && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name"
              className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
            />
            <input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="Phone"
              className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
            />
            <input
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
            />
            <button
              type="button"
              onClick={handleCreateOrUseGuest}
              className="md:col-span-3 px-4 py-3 bg-amber-500/15 text-amber-300 rounded-xl border border-amber-500/30 hover:bg-amber-500/20"
            >
              Create or Reuse Guest Profile
            </button>
          </div>
        )}

        {selectedGuest && (
          <div className="mt-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3">
            <UserRound className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-emerald-300 font-medium">{selectedGuest.name}</p>
              <p className="text-emerald-200/80 text-sm">
                {selectedGuest.phone || 'No phone'} · {selectedGuest.email || 'No email'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-slate-100">
            Step 2 — Select Room & Dates
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
          />
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {!selectedGuest ? (
          <p className="text-slate-500">Select or create a guest profile to load room availability.</p>
        ) : availableRooms === undefined ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-amber-500/20 border-t-amber-500"></div>
          </div>
        ) : availableRooms.length === 0 ? (
          <p className="text-slate-500">No rooms available for selected dates.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableRooms.map((room) => (
              <button
                key={room._id}
                type="button"
                onClick={() => setSelectedRoomId(room._id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  selectedRoomId === room._id
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <p className="text-slate-100 font-semibold">Room {room.roomNumber}</p>
                <p className="text-slate-400 text-sm capitalize">{room.type}</p>
                <p className="text-amber-300 text-sm mt-2">${(room.basePrice / 100).toFixed(2)} / night</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-slate-100">Step 3 — Book & Confirm</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {PACKAGES.map((pkg) => (
            <button
              key={pkg.type}
              type="button"
              onClick={() => setSelectedPackage(pkg.type)}
              className={`text-left p-3 rounded-xl border transition-all ${
                selectedPackage === pkg.type
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
              }`}
            >
              <p className="text-slate-100 font-medium">{pkg.label}</p>
              <p className="text-slate-400 text-sm">+${(pkg.addOnPerNight / 100).toFixed(2)} / night</p>
            </button>
          ))}
        </div>

        <textarea
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          placeholder="Special requests (optional)"
          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 mb-4"
          rows={3}
        />

        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-sm mb-4">
          <p className="text-slate-300">Guest: {selectedGuest?.name || '—'}</p>
          <p className="text-slate-300">
            Room: {selectedRoom ? `Room ${selectedRoom.roomNumber}` : '—'}
          </p>
          <p className="text-slate-300">Dates: {checkIn} → {checkOut}</p>
          <p className="text-slate-300">Nights: {nights}</p>
          <p className="text-amber-300 font-semibold mt-2">
            Total: ${(totalPrice / 100).toFixed(2)}
          </p>
        </div>

        <button
          type="button"
          disabled={!selectedGuest || !selectedRoom || submitting}
          onClick={handleConfirmBooking}
          className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Booking...' : 'Book & Confirm'}
        </button>
      </div>
    </div>
  )
}
