import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'

import { useI18n } from '../../../lib/i18n'
import { createComplaintFormSchema } from './-complaintFormSchema'
import type { ComplaintFormValues } from './-complaintFormSchema'
import type { Id } from '../../../../convex/_generated/dataModel'

interface ComplaintModalProps {
  isSignedIn: boolean
  hotels: Array<{
    _id: Id<'hotels'>
    name: string
    city: string
    country: string
  }>
  bookings: Array<{
    _id: Id<'bookings'>
    hotelId: Id<'hotels'>
    checkIn: string
    checkOut: string
    status: string
  }>
  complaintError: string
  complaintSaving: boolean
  complaintRedirect: string
  onClose: () => void
  onSubmit: (values: ComplaintFormValues) => Promise<void>
}

export function ComplaintModal({
  isSignedIn,
  hotels,
  bookings,
  complaintError,
  complaintSaving,
  complaintRedirect,
  onClose,
  onSubmit,
}: ComplaintModalProps) {
  const navigate = useNavigate()
  const { t } = useI18n()

  const schema = useMemo(
    () =>
      createComplaintFormSchema({
        hotelRequired: t('complaint.validation.hotelRequired'),
        subjectMin: t('complaint.validation.subjectMin'),
        subjectMax: t('complaint.validation.subjectMax'),
        descriptionMin: t('complaint.validation.descriptionMin'),
        descriptionMax: t('complaint.validation.descriptionMax'),
      }),
    [t],
  )

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<ComplaintFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      hotelId: '',
      subject: '',
      description: '',
      bookingId: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  const selectedHotelId = watch('hotelId')
  const selectedBookingId = watch('bookingId')
  const descriptionValue = watch('description')

  const bookingsForSelectedHotel = useMemo(
    () =>
      selectedHotelId
        ? bookings.filter((booking) => booking.hotelId === selectedHotelId)
        : [],
    [bookings, selectedHotelId],
  )

  useEffect(() => {
    if (!selectedBookingId) {
      return
    }

    const stillVisible = bookingsForSelectedHotel.some(
      (booking) => booking._id === selectedBookingId,
    )

    if (!stillVisible) {
      setValue('bookingId', '')
    }
  }, [bookingsForSelectedHotel, selectedBookingId, setValue])

  useEffect(() => {
    reset({
      hotelId: '',
      subject: '',
      description: '',
      bookingId: '',
    })
  }, [reset])

  const statusLabel = (status: string) => {
    switch (status) {
      case 'held':
      case 'pending_payment':
      case 'confirmed':
      case 'checked_in':
      case 'checked_out':
      case 'cancelled':
      case 'expired':
      case 'outsourced':
        return t(`booking.status.${status}` as never)
      default:
        return status
    }
  }

  const formError =
    errors.hotelId?.message ??
    errors.subject?.message ??
    errors.description?.message ??
    complaintError

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center z-[70] p-3 sm:p-4 overflow-y-auto">
      <div
        className="complaint-modal-panel bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto my-3 sm:my-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complaint-modal-title"
        aria-describedby="complaint-modal-description"
      >
        <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2
              id="complaint-modal-title"
              className="text-xl font-semibold text-slate-100"
            >
              {t('complaint.title')}
            </h2>
            <p
              id="complaint-modal-description"
              className="text-sm text-slate-500 mt-1"
            >
              {t('complaint.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5">
          {!isSignedIn ? (
            <div className="space-y-5">
              <p className="text-slate-400">{t('complaint.signInPrompt')}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/sign-in',
                      search: { redirect: complaintRedirect },
                    })
                  }
                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
                >
                  {t('header.signIn')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/sign-up',
                      search: { redirect: complaintRedirect },
                    })
                  }
                  className="flex-1 px-4 py-3 bg-blue-500 text-slate-900 font-semibold rounded-xl hover:bg-blue-400 transition-colors"
                >
                  {t('header.signUp')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('complaint.hotel')}
                </label>
                <select
                  {...register('hotelId')}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
                >
                  <option value="">{t('complaint.selectHotel')}</option>
                  {hotels.map((hotel) => (
                    <option key={hotel._id} value={hotel._id}>
                      {hotel.name} - {hotel.city}, {hotel.country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('complaint.bookingOptional')}
                </label>
                <select
                  {...register('bookingId')}
                  disabled={!selectedHotelId || bookingsForSelectedHotel.length === 0}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
                >
                  <option value="">{t('complaint.selectBooking')}</option>
                  {bookingsForSelectedHotel.map((booking) => (
                    <option key={booking._id} value={booking._id}>
                      {booking.checkIn} - {booking.checkOut} ({statusLabel(booking.status)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('complaint.subject')}
                </label>
                <input
                  {...register('subject')}
                  type="text"
                  maxLength={120}
                  placeholder={t('complaint.subjectPlaceholder')}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('complaint.description')}
                </label>
                <textarea
                  {...register('description')}
                  rows={4}
                  maxLength={2000}
                  placeholder={t('complaint.descriptionPlaceholder')}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
                <p className="text-xs text-slate-500 mt-2">
                  {descriptionValue.length}/2000
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={complaintSaving}
                  className="flex-1 px-4 py-3 bg-blue-500 text-slate-900 font-semibold rounded-xl hover:bg-blue-400 transition-colors disabled:opacity-60"
                >
                  {complaintSaving
                    ? t('complaint.submitting')
                    : t('complaint.submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
