// Modal used to outsource a booking to another hotel when capacity is unavailable.
import { useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useI18n } from '../../../../lib/i18n'
import { useTheme } from '../../../../lib/theme'

interface EnrichedBooking {
  booking: {
    _id: Id<'bookings'>
    status: string
    paymentStatus?: string
    totalPrice: number
    checkIn: string
    checkOut: string
  }
  guestProfile?: {
    name: string
  }
  room: {
    _id: Id<'rooms'>
  }
  hotel: {
    _id: Id<'hotels'>
    name: string
    city: string
    country: string
  }
}

interface OutsourceModalProps {
  bookingDetail: EnrichedBooking
  onClose: () => void
  onSuccess: () => void
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  // Normalize unknown error shapes into user-friendly text.
  if (error && typeof error === 'object') {
    const candidate = error as { data?: { message?: string }; message?: string }
    if (candidate.data?.message) return candidate.data.message
    if (candidate.message) return candidate.message
  }

  return fallbackMessage
}

export function OutsourceModal({
  bookingDetail,
  onClose,
  onSuccess,
}: OutsourceModalProps) {
  // Load destination hotels and submit outsource operation for selected target.
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [destinationHotelId, setDestinationHotelId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const destinationHotels = useQuery((api as any).hotels.listForOutsource, {
    excludeHotelId: bookingDetail.hotel._id,
  }) as
    | Array<{
        _id: Id<'hotels'>
        name: string
        city: string
        country: string
      }>
    | undefined

  const outsourceBooking = useMutation((api as any).bookings.outsourceBooking)

  const amountPaid = useMemo(
    () =>
      bookingDetail.booking.paymentStatus === 'paid'
        ? `$${(bookingDetail.booking.totalPrice / 100).toFixed(2)}`
        : t('admin.bookings.pending'),
    [bookingDetail.booking.paymentStatus, bookingDetail.booking.totalPrice, t],
  )

  const guestName =
    bookingDetail.guestProfile?.name || t('admin.bookings.guest')

  const handleSubmit = async () => {
    if (!destinationHotelId) {
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await outsourceBooking({
        bookingId: bookingDetail.booking._id,
        destinationHotelId: destinationHotelId as Id<'hotels'>,
      })

      setIsSuccess(true)
      setTimeout(() => {
        onSuccess()
      }, 1500)
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          t('admin.bookings.outsourceModal.errorFallback'),
        ),
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="absolute inset-0"
        onClick={isSubmitting ? undefined : onClose}
        role="button"
        tabIndex={-1}
      />
      <div
        className={`relative border rounded-2xl shadow-2xl w-full max-w-lg ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
      >
        <div
          className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
        >
          <h3
            className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          >
            {t('admin.bookings.outsourceModal.title')}
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div
            className={`border rounded-xl p-4 space-y-3 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <div>
              <p
                className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.bookings.outsourceModal.currentHotel')}
              </p>
              <p
                className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
              >
                {bookingDetail.hotel.name} · {bookingDetail.hotel.city},{' '}
                {bookingDetail.hotel.country}
              </p>
            </div>

            <div>
              <p
                className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.bookings.guest')}
              </p>
              <p
                className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
              >
                {guestName}
              </p>
            </div>

            <div>
              <p
                className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.bookings.stay')}
              </p>
              <p
                className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
              >
                {bookingDetail.booking.checkIn} →{' '}
                {bookingDetail.booking.checkOut}
              </p>
            </div>

            <div>
              <p
                className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.bookings.amountPaid')}
              </p>
              <p
                className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
              >
                {amountPaid}
              </p>
            </div>
          </div>

          <div>
            <label
              className={`block text-sm mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
            >
              {t('admin.bookings.outsourceModal.destinationHotelRequired')}
            </label>
            <select
              value={destinationHotelId}
              onChange={(event) => setDestinationHotelId(event.target.value)}
              disabled={isSubmitting || isSuccess}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:border-blue-500/50 transition-colors ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-sm'}`}
            >
              <option value="">
                {t('admin.bookings.outsourceModal.selectHotel')}
              </option>
              {destinationHotels?.map((hotel) => (
                <option key={hotel._id} value={hotel._id}>
                  {hotel.name} · {hotel.city}, {hotel.country}
                </option>
              ))}
            </select>
            {errorMessage && (
              <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2 border rounded-lg transition-colors text-sm font-medium disabled:opacity-50 ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!destinationHotelId || isSubmitting || isSuccess}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSuccess
                ? t('admin.bookings.outsourceModal.success')
                : t('admin.bookings.outsourceModal.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
