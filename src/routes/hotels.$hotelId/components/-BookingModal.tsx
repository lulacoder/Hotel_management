// Booking confirmation modal for selecting guest details and creating reservations.
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { Building2, CheckCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import {
  PACKAGES,
  formatPackageAddOn,
  getPackageByType,
} from '../../../lib/packages'
import { useI18n } from '../../../lib/i18n'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { PackageType } from '../../../lib/packages'

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
  // Fetch room/hotel context and manage a 3-step booking flow in local state.
  const { user } = useUser()
  const { t } = useI18n()
  const room = useQuery(api.rooms.get, { roomId })
  const hotel = useQuery(api.hotels.get, { hotelId })
  const holdRoom = useMutation(api.bookings.holdRoom)
  const confirmBooking = useMutation(api.bookings.confirmBooking)

  const [step, setStep] = useState<'package' | 'details' | 'confirm'>('package')
  const [selectedPackageType, setSelectedPackageType] =
    useState<PackageType>('room_only')
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
      guestEmail: prev.guestEmail || user.emailAddresses[0]?.emailAddress || '',
    }))
  }, [user])

  const handleHold = async (e: React.FormEvent) => {
    // Step 1 submission: place temporary hold with package + guest details.
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
        packageType: selectedPackageType,
        packageAddOn: getPackageByType(selectedPackageType).addOnPerNight,
        guestName: guestDetails.guestName,
        guestEmail: guestDetails.guestEmail,
        specialRequests: guestDetails.specialRequests || undefined,
      })
      setBookingId(id)
      setStep('confirm')
    } catch (err: any) {
      setError(err.message || t('bookingModal.failedHold'))
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    // Step 2 confirmation: convert hold to confirmed booking.
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
      if (err?.data?.code === 'EXPIRED') {
        setError(t('bookingModal.holdExpired'))
      } else {
        setError(err.message || t('bookingModal.failedConfirm'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (!room || !hotel) {
    return null
  }

  const selectedPackage = getPackageByType(selectedPackageType)
  const roomSubtotalCents = room.basePrice * nights
  const packageSubtotalCents = selectedPackage.addOnPerNight * nights
  const totalPriceCents = roomSubtotalCents + packageSubtotalCents

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">
            {step === 'package'
              ? t('bookingModal.step.packageTitle')
              : step === 'details'
                ? t('bookingModal.step.detailsTitle')
                : t('bookingModal.step.confirmTitle')}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {step === 'package'
              ? t('bookingModal.step.packageDescription')
              : step === 'details'
                ? t('bookingModal.step.detailsDescription')
                : t('bookingModal.step.confirmDescription')}
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
                  {t('hotel.room')} {room.roomNumber} - {room.type}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">{t('booking.checkIn')}</p>
                <p className="text-slate-200">{checkIn}</p>
              </div>
              <div>
                <p className="text-slate-500">{t('booking.checkOut')}</p>
                <p className="text-slate-200">{checkOut}</p>
              </div>
            </div>
            <div className="border-t border-slate-700 mt-4 pt-4 flex justify-between">
              <div className="text-slate-400 text-sm">
                <p>
                  {t('hotel.room')}: ${(room.basePrice / 100).toFixed(0)} ×{' '}
                  {nights} {nights !== 1 ? t('hotel.nights') : t('hotel.night')}
                </p>
                {selectedPackage.addOnPerNight > 0 && (
                  <p>
                    {t('booking.package')}: $
                    {(selectedPackage.addOnPerNight / 100).toFixed(0)} ×{' '}
                    {nights}
                  </p>
                )}
              </div>
              <span className="text-xl font-bold text-amber-400">
                ${(totalPriceCents / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {step === 'package' ? (
            <div className="space-y-3">
              {PACKAGES.map((pkg) => {
                const isSelected = pkg.type === selectedPackageType

                return (
                  <button
                    key={pkg.type}
                    type="button"
                    onClick={() => setSelectedPackageType(pkg.type)}
                    className={`w-full text-left rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-slate-100 font-semibold">
                          {pkg.label}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {pkg.description}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                          isSelected
                            ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                            : 'text-slate-300 border-slate-600 bg-slate-700/40'
                        }`}
                      >
                        {formatPackageAddOn(pkg.addOnPerNight)}
                      </span>
                    </div>

                    <ul className="list-disc list-inside text-sm text-slate-400 space-y-0.5">
                      {pkg.inclusions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </button>
                )
              })}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all"
                >
                  {t('bookingModal.continue')}
                </button>
              </div>
            </div>
          ) : step === 'details' ? (
            <form onSubmit={handleHold} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('bookingModal.guestName')}
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
                  {t('bookingModal.email')}
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
                  {t('bookingModal.specialRequests')}
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
                  placeholder={t('bookingModal.specialRequestsPlaceholder')}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all resize-none"
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-400 text-sm">
                  {t('bookingModal.holdNotice')}
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>
                    {t('bookingModal.roomRate')} ({nights}{' '}
                    {nights !== 1 ? t('hotel.nights') : t('hotel.night')})
                  </span>
                  <span>${(roomSubtotalCents / 100).toFixed(2)}</span>
                </div>
                {selectedPackage.addOnPerNight > 0 && (
                  <div className="flex items-center justify-between text-slate-300 mt-2">
                    <span>
                      {selectedPackage.label} {t('bookingModal.addOn')} (
                      {nights}{' '}
                      {nights !== 1 ? t('hotel.nights') : t('hotel.night')})
                    </span>
                    <span>${(packageSubtotalCents / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-700 mt-3 pt-3 flex items-center justify-between text-amber-400 font-semibold">
                  <span>{t('booking.total')}</span>
                  <span>${(totalPriceCents / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('package')}
                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  {t('signIn.back')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50"
                >
                  {loading
                    ? t('bookingModal.holding')
                    : t('bookingModal.holdRoom')}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">
                    {t('bookingModal.heldSuccess')}
                  </span>
                </div>
                <p className="text-slate-400 text-sm">
                  {t('bookingModal.heldDescription')}
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>
                    {t('bookingModal.roomRate')} ({nights}{' '}
                    {nights !== 1 ? t('hotel.nights') : t('hotel.night')})
                  </span>
                  <span>${(roomSubtotalCents / 100).toFixed(2)}</span>
                </div>
                {selectedPackage.addOnPerNight > 0 && (
                  <div className="flex items-center justify-between text-slate-300 mt-2">
                    <span>
                      {selectedPackage.label} {t('bookingModal.addOn')} (
                      {nights}{' '}
                      {nights !== 1 ? t('hotel.nights') : t('hotel.night')})
                    </span>
                    <span>${(packageSubtotalCents / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-700 mt-3 pt-3 flex items-center justify-between text-emerald-400 font-semibold">
                  <span>{t('booking.total')}</span>
                  <span>${(totalPriceCents / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  {t('bookingModal.cancelHold')}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50"
                >
                  {loading
                    ? t('bookingModal.confirming')
                    : t('booking.confirmBooking')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
