// Modal used to outsource a booking to another hotel when capacity is unavailable.
import { useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'

import { api } from '../../../../../convex/_generated/api'
import { useI18n } from '../../../../lib/i18n/provider'
import { useTheme } from '../../../../lib/theme'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useMutation, useQuery } from '@/integrations/convex/hooks'
import { formatUsdAmount } from '@/lib/currency'
import { getErrorMessage } from '@/lib/errors'

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

  const destinationHotels = useQuery(api.hotels.listForOutsource, {
    excludeHotelId: bookingDetail.hotel._id,
  })

  const outsourceBooking = useMutation(api.bookings.outsourceBooking)

  const amountPaid = useMemo(
    () =>
      bookingDetail.booking.paymentStatus === 'paid'
        ? formatUsdAmount(bookingDetail.booking.totalPrice)
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
      <button
        type="button"
        aria-label={t('admin.bookings.outsourceModal.errorFallback')}
        className="absolute inset-0"
        onClick={isSubmitting ? undefined : onClose}
      />
      <div className="admin-modal-panel relative w-full max-w-lg">
        <div className="admin-modal-header">
          <h3
            className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          >
            {t('admin.bookings.outsourceModal.title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}`}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="admin-modal-body space-y-4">
          <div className="admin-surface-muted p-4 space-y-3">
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
              className="admin-select"
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

          <div className="admin-modal-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="admin-button-secondary text-sm disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!destinationHotelId || isSubmitting || isSuccess}
              className="admin-button-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
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
