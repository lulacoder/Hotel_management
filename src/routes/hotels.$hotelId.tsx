// Hotel detail route showing rooms, amenities, and booking entry flow.
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
  Menu,
  X,
  Home,
} from 'lucide-react'
import { useState } from 'react'

import { BookingModal } from './hotels.$hotelId/components/-BookingModal'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { ThemeToggle } from '../components/ThemeToggle'
import { useI18n } from '../lib/i18n'
import { getHotelCategoryLabel } from '../lib/hotelCategories'

export const Route = createFileRoute('/hotels/$hotelId')({
  // Dynamic route for a single hotel's details and available rooms.
  component: HotelDetailPage,
})

function HotelDetailPage() {
  // Load hotel + room availability and maintain booking date selections.
  const { hotelId } = Route.useParams()
  const { user, isSignedIn } = useUser()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [selectedDates, setSelectedDates] = useState({
    checkIn: '',
    checkOut: '',
  })
  const [showBookingModal, setShowBookingModal] = useState<Id<'rooms'> | null>(
    null,
  )
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  const roomTypeLabels: Record<string, string> = {
    budget: t('hotel.budgetRoom'),
    standard: t('hotel.standardRoom'),
    suite: t('hotel.suiteRoom'),
    deluxe: t('hotel.deluxeRoom'),
  }

  const amenityIcons: Record<string, typeof Wifi> = {
    WiFi: Wifi,
    TV: Tv,
    'Air Conditioning': Wind,
    'Mini Bar': Coffee,
  }

  // Calculate number of nights
  const calculateNights = () => {
    // Shared calculation used by room summary pricing labels.
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
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 border-t-blue-500"></div>
      </div>
    )
  }

  if (hotel === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center max-w-md">
          <h2 className="text-xl font-semibold text-slate-300 mb-2">
            {t('hotel.notFoundTitle')}
          </h2>
          <p className="text-slate-500 mb-6">
            {t('hotel.notFoundDescription')}
          </p>
          <Link
            to="/select-location"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('hotel.backToHotels')}
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
          {/* Left: back link (all sizes) */}
          <Link
            to="/select-location"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden md:inline">{t('hotel.backToHotels')}</span>
          </Link>

          {/* Desktop right-side actions */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher compact />
            <ThemeToggle compact />
            {isSignedIn ? (
              <>
                <Link
                  to="/bookings"
                  className="px-3 py-1.5 text-sm font-semibold text-slate-900 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors"
                >
                  {t('header.myBookings')}
                </Link>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <Link
                  to="/sign-in"
                  className="text-slate-400 hover:text-blue-400 transition-colors font-medium"
                >
                  {t('header.signIn')}
                </Link>
                <Link
                  to="/sign-up"
                  className="px-3 py-1.5 bg-blue-500 text-slate-900 font-semibold rounded-lg hover:bg-blue-400 transition-colors"
                >
                  {t('header.signUp')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile right-side: LanguageSwitcher + My Bookings + hamburger */}
          <div className="flex md:hidden items-center gap-3">
            <LanguageSwitcher compact />
            {isSignedIn && (
              <Link
                to="/bookings"
                className="px-3 py-1.5 text-sm font-semibold text-slate-900 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors"
              >
                {t('header.myBookings')}
              </Link>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 group"
              aria-label={t('header.openMenu')}
            >
              <Menu
                size={22}
                className="text-slate-300 group-hover:text-blue-400 transition-colors"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-out Menu */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-800/50 shadow-2xl z-[60] transform transition-transform duration-500 ease-out flex flex-col ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-10 rounded-xl bg-slate-950/70 border border-blue-500/30 px-1 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-8 w-auto object-contain logo-tight"
              />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {t('header.navigationMenu')}
            </p>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2.5 hover:bg-white/5 rounded-xl transition-all duration-300 group"
            aria-label={t('header.closeMenu')}
          >
            <X
              size={22}
              className="text-slate-400 group-hover:text-white transition-colors"
            />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 group"
            >
              <Home size={20} className="group-hover:text-blue-400 transition-colors" />
              <span className="font-medium">{t('header.home')}</span>
            </Link>

            <Link
              to="/select-location"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 group"
            >
              <MapPin size={20} className="group-hover:text-blue-400 transition-colors" />
              <span className="font-medium">{t('header.browseLocations')}</span>
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800/50">
            <div className="flex items-center gap-3 px-4 py-3">
              <ThemeToggle />
            </div>
          </div>

          {!isSignedIn && (
            <div className="mt-6 pt-6 border-t border-slate-800/50">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3 px-4">
                {t('header.account')}
              </p>
              <div className="space-y-2">
                <Link
                  to="/sign-in"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-300 border border-slate-700 hover:border-slate-600 hover:bg-white/5 transition-all duration-300 font-medium"
                >
                  {t('header.signIn')}
                </Link>
                <Link
                  to="/sign-up"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25"
                >
                  {t('header.createAccount')}
                </Link>
              </div>
            </div>
          )}
        </nav>

        {isSignedIn && (
          <div className="p-4 border-t border-slate-800/50 bg-slate-800/30">
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <span className="text-sm text-slate-400">{user?.firstName || ''}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] transition-all duration-500 ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

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
                    <Star className="w-4 h-4 text-blue-400 fill-blue-400" />
                    <span className="text-sm text-slate-200 font-medium">
                      {hotel.rating.toFixed(1)}
                    </span>
                  </div>
                )}
                {hotel.category && (
                    <span
                    className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      hotel.category === 'Luxury'
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      : hotel.category === 'Boutique'
                        ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                        : hotel.category === 'Resort and Spa'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : hotel.category === 'Suite'
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : hotel.category === 'Extended-Stay'
                          ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                          : hotel.category === 'Budget'
                            ? 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                    >
                    {getHotelCategoryLabel(hotel.category, t)}
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
                    {t('hotel.freeParking')}
                  </div>
                )}
                {hotel.lastRenovationDate && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded-lg text-slate-400 text-xs">
                    <Calendar className="w-3 h-3" />
                    {t('hotel.renovated', {
                      year: hotel.lastRenovationDate.split('-')[0],
                    })}
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
            {t('hotel.selectDates')}
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            {t('hotel.selectDatesDescription')}
          </p>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm text-slate-400 mb-2">
                {t('booking.checkIn')}
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
                className="hotel-date-input w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-slate-400 mb-2">
                {t('booking.checkOut')}
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
                className="hotel-date-input w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
            {nights > 0 && (
              <div className="flex items-end">
                <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <span className="text-blue-400 font-semibold">
                    {nights} {nights !== 1 ? t('hotel.nights') : t('hotel.night')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rooms Grid */}
        <h2 className="text-xl font-semibold text-slate-200 mb-4">
          {selectedDates.checkIn && selectedDates.checkOut
            ? t('hotel.availableRooms')
            : t('hotel.allRooms')}
        </h2>

        {rooms === undefined ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-500"></div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              {t('hotel.noRoomsAvailable')}
            </h3>
            <p className="text-slate-500">
              {selectedDates.checkIn && selectedDates.checkOut
                ? t('hotel.tryDifferentDates')
                : t('hotel.noAvailableRooms')}
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
                <div className="h-40 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
                  {room.imageUrl ? (
                    <img
                      src={room.imageUrl}
                      alt={`${t('hotel.room')} ${room.roomNumber}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-12 h-12 text-slate-700" />
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-200">
                        {t('hotel.room')} {room.roomNumber}
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
                      <p className="text-2xl font-bold text-blue-400">
                        ${(room.basePrice / 100).toFixed(0)}
                      </p>
                      <p className="text-sm text-slate-500">
                        {t('hotel.perNight')}
                      </p>
                    </div>
                  </div>

                  {/* Room Details */}
                  <div className="flex items-center gap-4 text-sm text-slate-400 mb-4 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>
                        {t('hotel.upTo', { count: room.maxOccupancy })}
                      </span>
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
                            <Cigarette className="w-4 h-4 text-blue-500" />
                            <span className="text-blue-500">
                              {t('hotel.smoking')}
                            </span>
                          </>
                        ) : (
                          <>
                            <CigaretteOff className="w-4 h-4 text-emerald-500" />
                            <span className="text-emerald-500">
                              {t('hotel.nonSmoking')}
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
                          ${(room.basePrice / 100).toFixed(0)} x {nights}{' '}
                          {nights !== 1 ? t('hotel.nights') : t('hotel.night')}
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
                        alert(t('hotel.selectDatesFirst'))
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
                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedDates.checkIn && selectedDates.checkOut
                      ? isSignedIn
                        ? t('hotel.bookNow')
                        : t('hotel.signInToBook')
                      : t('hotel.selectDatesToBook')}
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

