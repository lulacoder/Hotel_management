// Walk-in booking management route for eligible hotel staff/admin users.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Calendar, CheckCircle, Search, UserRound } from 'lucide-react'
import { motion } from 'motion/react'

import { api } from '../../../../convex/_generated/api'
import {
  PACKAGES,
  getPackageByType,
  getPackageLabel,
} from '../../../lib/packages'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { PackageType } from '../../../lib/packages'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '../../../lib/theme'

export const Route = createFileRoute('/admin/walk-in/')({
  // Register walk-in booking route for hotel cashier/admin workflows.
  component: WalkInBookingPage,
})

type GuestProfileLite = {
  _id: Id<'guestProfiles'>
  name: string
  phone?: string
  email?: string
}

function normalizePhone(value: string): string {
  // Canonicalize phone input for matching and storage.
  return value.replace(/\D/g, '')
}

function getNights(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00`)
  const end = new Date(`${checkOut}T00:00:00`)
  const diff = end.getTime() - start.getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function WalkInBookingPage() {
  // Manage guest search/creation, room selection, and walk-in booking submission.
  const { user } = useUser()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  const [searchTerm, setSearchTerm] = useState('')
  const [submittedTerm, setSubmittedTerm] = useState('')
  const [selectedGuest, setSelectedGuest] = useState<GuestProfileLite | null>(
    null,
  )

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
  const [selectedPackage, setSelectedPackage] =
    useState<PackageType>('room_only')
  const [specialRequests, setSpecialRequests] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canUseWalkIn =
    hotelAssignment?.role === 'hotel_cashier' ||
    hotelAssignment?.role === 'hotel_admin'

  const searchResults = useQuery(
    (api as any).guestProfiles.search,
    user?.id && submittedTerm.trim().length >= 2
      ? { searchTerm: submittedTerm }
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
  ) as
    | Array<{
        _id: Id<'rooms'>
        roomNumber: string
        type: string
        basePrice: number
      }>
    | undefined

  const createGuest = useMutation((api as any).guestProfiles.findOrCreate)
  const createWalkInBooking = useMutation((api as any).bookings.walkInBooking)

  const selectedRoom = availableRooms?.find(
    (room) => room._id === selectedRoomId,
  )
  const nights = checkIn && checkOut ? getNights(checkIn, checkOut) : 1

  const roomSubtotal = selectedRoom ? selectedRoom.basePrice * nights : 0
  const packageAddOn = getPackageByType(selectedPackage).addOnPerNight * nights
  const totalPrice = roomSubtotal + packageAddOn

  const handleSearch = () => {
    // Trigger server-side search using trimmed query and clear selected guest.
    setSubmittedTerm(searchTerm.trim())
    setSelectedGuest(null)
  }

  const handleCreateOrUseGuest = async () => {
    if (!user?.id) return

    const name = guestName.trim()
    const phone = normalizePhone(guestPhone)
    const email = guestEmail.trim().toLowerCase()

    if (!name) {
      setBookingError(t('admin.walkIn.error.guestNameRequired'))
      return
    }

    if (!phone && !email) {
      setBookingError(t('admin.walkIn.error.contactRequired'))
      return
    }

    setBookingError('')

    try {
      const guestProfileId = (await createGuest({
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
      setBookingError(
        error?.message || t('admin.walkIn.error.createGuestFailed'),
      )
    }
  }

  const handleConfirmBooking = async () => {
    if (!user?.id || !selectedGuest || !selectedRoom) return

    setSubmitting(true)
    setBookingError('')

    try {
      await createWalkInBooking({
        guestProfileId: selectedGuest._id,
        roomId: selectedRoom._id,
        checkIn,
        checkOut,
        packageType: selectedPackage,
        packageAddOn: getPackageByType(selectedPackage).addOnPerNight,
        specialRequests: specialRequests.trim() || undefined,
      })

      navigate({
        to: '/admin/bookings',
        search: { status: 'all', paymentStatus: 'all', window: '30d' },
      })
    } catch (error: any) {
      setBookingError(
        error?.message || t('admin.walkIn.error.createBookingFailed'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Shared input class helper
  const inputClass = isDark
    ? 'bg-slate-800/50 border border-slate-700 text-slate-200 placeholder-slate-500 focus:border-blue-500/50'
    : 'bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-amber-400/60 shadow-sm'

  const sectionCardClass = isDark
    ? 'bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6'
    : 'bg-white/80 border border-slate-200/80 rounded-2xl p-6 shadow-sm backdrop-blur-sm'

  const selectableCardBase =
    'walkin-selectable-card text-left p-3 rounded-xl border transition-all'
  const selectableCardSelected = isDark
    ? 'border-blue-500/40 bg-blue-500/10'
    : 'border-amber-500/40 bg-amber-50'
  const selectableCardIdle = isDark
    ? 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'

  if (profile === undefined || hotelAssignment === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-500/20 border-t-blue-500' : 'border-amber-500/20 border-t-amber-500'}`}
        ></div>
      </div>
    )
  }

  if (!canUseWalkIn) {
    return (
      <div className="max-w-4xl mx-auto">
        <div
          className={`rounded-2xl p-10 text-center border ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}
        >
          <h2
            className={`text-xl font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          >
            {t('admin.accessDenied')}
          </h2>
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            {t('admin.walkIn.accessDescription')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1
          className={`text-3xl font-semibold tracking-tight mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {t('admin.nav.walkIn')}
        </h1>
        <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
          {t('admin.walkIn.description')}
        </p>
      </motion.div>

      {bookingError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {bookingError}
        </div>
      )}

      {/* Step 1 — Guest */}
      <motion.div
        className={sectionCardClass}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Search
            className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-amber-500'}`}
          />
          <h2
            className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          >
            {t('admin.walkIn.step1')}
          </h2>
        </div>

        <div className="flex gap-3 mb-4">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('admin.walkIn.searchPlaceholder')}
            className={`flex-1 px-4 py-3 rounded-xl focus:outline-none transition-all ${inputClass}`}
          />
          <button
            type="button"
            onClick={handleSearch}
            className={`px-4 py-3 rounded-xl border transition-colors ${
              isDark
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {t('admin.walkIn.search')}
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
                className={`${selectableCardBase} w-full ${
                  selectedGuest?._id === item.profile._id
                    ? selectableCardSelected
                    : selectableCardIdle
                }`}
              >
                <p
                  className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                >
                  {item.profile.name}
                </p>
                <p
                  className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  {item.profile.phone || t('admin.bookings.noPhone')} ·{' '}
                  {item.profile.email || t('admin.bookings.noEmail')}
                </p>
                <p
                  className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {t('admin.walkIn.pastBookings', { count: item.bookingCount })}
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
              placeholder={t('admin.walkIn.guestName')}
              className={`px-4 py-3 rounded-xl focus:outline-none transition-all ${inputClass}`}
            />
            <input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder={t('admin.walkIn.phone')}
              className={`px-4 py-3 rounded-xl focus:outline-none transition-all ${inputClass}`}
            />
            <input
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder={t('admin.walkIn.email')}
              type="email"
              className={`px-4 py-3 rounded-xl focus:outline-none transition-all ${inputClass}`}
            />
            <button
              type="button"
              onClick={handleCreateOrUseGuest}
              className={`md:col-span-3 px-4 py-3 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/20'
                  : 'bg-amber-500/10 text-amber-700 border-amber-400/30 hover:bg-amber-500/15'
              }`}
            >
              {t('admin.walkIn.createOrReuseGuest')}
            </button>
          </div>
        )}

        {selectedGuest && (
          <div className="mt-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3">
            <UserRound className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-emerald-300 font-medium">
                {selectedGuest.name}
              </p>
              <p className="text-emerald-200/80 text-sm">
                {selectedGuest.phone || t('admin.bookings.noPhone')} ·{' '}
                {selectedGuest.email || t('admin.bookings.noEmail')}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Step 2 — Dates & Room */}
      <motion.div
        className={sectionCardClass}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.14 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Calendar
            className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-amber-500'}`}
          />
          <h2
            className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          >
            {t('admin.walkIn.step2')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className={`hotel-date-input px-4 py-3 rounded-xl focus:outline-none transition-all ${inputClass}`}
          />
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className={`hotel-date-input px-4 py-3 rounded-xl focus:outline-none transition-all ${inputClass}`}
          />
        </div>

        {!selectedGuest ? (
          <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
            {t('admin.walkIn.selectGuestFirst')}
          </p>
        ) : availableRooms === undefined ? (
          <div className="flex items-center justify-center py-8">
            <div
              className={`animate-spin rounded-full h-7 w-7 border-2 ${isDark ? 'border-blue-500/20 border-t-blue-500' : 'border-amber-500/20 border-t-amber-500'}`}
            ></div>
          </div>
        ) : availableRooms.length === 0 ? (
          <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
            {t('admin.walkIn.noRooms')}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableRooms.map((room) => (
              <button
                key={room._id}
                type="button"
                onClick={() => setSelectedRoomId(room._id)}
                className={`${selectableCardBase} p-4 ${
                  selectedRoomId === room._id
                    ? selectableCardSelected
                    : selectableCardIdle
                }`}
              >
                <p
                  className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
                >
                  {t('hotel.room')} {room.roomNumber}
                </p>
                <p
                  className={`text-sm capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  {room.type}
                </p>
                <p
                  className={`text-sm mt-2 ${isDark ? 'text-blue-300' : 'text-amber-600'}`}
                >
                  ${(room.basePrice / 100).toFixed(2)} / {t('hotel.night')}
                </p>
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Step 3 — Package & Confirm */}
      <motion.div
        className={sectionCardClass}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle
            className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-amber-500'}`}
          />
          <h2
            className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          >
            {t('admin.walkIn.step3')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {PACKAGES.map((pkg) => (
            <button
              key={pkg.type}
              type="button"
              onClick={() => setSelectedPackage(pkg.type)}
              className={`${selectableCardBase} ${
                selectedPackage === pkg.type
                  ? selectableCardSelected
                  : selectableCardIdle
              }`}
            >
              <p
                className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
              >
                {getPackageLabel(pkg.type, t)}
              </p>
              <p
                className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
              >
                +${(pkg.addOnPerNight / 100).toFixed(2)} / {t('hotel.night')}
              </p>
            </button>
          ))}
        </div>

        <textarea
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          placeholder={t('bookingModal.specialRequestsPlaceholder')}
          className={`w-full px-4 py-3 rounded-xl focus:outline-none transition-all mb-4 ${inputClass}`}
          rows={3}
        />

        <div
          className={`rounded-xl p-4 text-sm mb-4 border ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
        >
          <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
            {t('admin.bookings.guest')}: {selectedGuest?.name || '—'}
          </p>
          <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
            {t('hotel.room')}:{' '}
            {selectedRoom
              ? `${t('hotel.room')} ${selectedRoom.roomNumber}`
              : '—'}
          </p>
          <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
            {t('admin.bookings.dates')}: {checkIn} → {checkOut}
          </p>
          <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
            {t('admin.walkIn.nights')}: {nights}
          </p>
          <p
            className={`font-semibold mt-2 ${isDark ? 'text-blue-300' : 'text-amber-600'}`}
          >
            {t('booking.total')}: ${(totalPrice / 100).toFixed(2)}
          </p>
        </div>

        <button
          type="button"
          disabled={!selectedGuest || !selectedRoom || submitting}
          onClick={handleConfirmBooking}
          className={`px-5 py-3 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isDark
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700'
          }`}
        >
          {submitting
            ? t('admin.walkIn.booking')
            : t('admin.walkIn.bookConfirm')}
        </button>
      </motion.div>
    </div>
  )
}
