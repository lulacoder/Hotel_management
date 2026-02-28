// Modal used to outsource a booking to another hotel when capacity is unavailable.
import { useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useI18n } from '../../../../lib/i18n'

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
  clerkUserId: string
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
  clerkUserId,
  onClose,
  onSuccess,
}: OutsourceModalProps) {
  // Load destination hotels and submit outsource operation for selected target.
  const { t } = useI18n()
  const [destinationHotelId, setDestinationHotelId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const destinationHotels = useQuery(
    (api as any).hotels.listForOutsource,
    clerkUserId
      ? {
          clerkUserId,
          excludeHotelId: bookingDetail.hotel._id,
        }
      : 'skip',
  ) as
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
    if (!destinationHotelId || !clerkUserId) {
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await outsourceBooking({
        clerkUserId,
        bookingId: bookingDetail.booking._id,
        destinationHotelId: destinationHotelId as Id<'hotels'>,
      })

      setIsSuccess(true)
      setTimeout(() => {
        onSuccess()
      }, 1500)
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t('admin.bookings.outsourceModal.errorFallback')),
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
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-slate-100">
            {t('admin.bookings.outsourceModal.title')}
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                {t('admin.bookings.outsourceModal.currentHotel')}
              </p>
              <p className="text-slate-100 font-medium">
                {bookingDetail.hotel.name} · {bookingDetail.hotel.city},{' '}
                {bookingDetail.hotel.country}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                {t('admin.bookings.guest')}
              </p>
              <p className="text-slate-100 font-medium">{guestName}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                {t('admin.bookings.stay')}
              </p>
              <p className="text-slate-100 font-medium">
                {bookingDetail.booking.checkIn} →{' '}
                {bookingDetail.booking.checkOut}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                {t('admin.bookings.amountPaid')}
              </p>
              <p className="text-slate-100 font-medium">{amountPaid}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">
              {t('admin.bookings.outsourceModal.destinationHotelRequired')}
            </label>
            <select
              value={destinationHotelId}
              onChange={(event) => setDestinationHotelId(event.target.value)}
              disabled={isSubmitting || isSuccess}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors"
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
              className="px-4 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium disabled:opacity-50"
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
