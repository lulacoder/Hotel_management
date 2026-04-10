import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '../../../lib/theme'
import { cn } from '../../../lib/utils'
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'

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
  const panelClass = isDark
    ? 'border-slate-800 bg-slate-900 text-slate-100'
    : 'border-slate-200/90 text-slate-900'
  const headerClass = isDark
    ? 'border-b border-slate-800 bg-slate-900/90'
    : 'border-b border-slate-200/90 bg-gradient-to-b from-white to-slate-50/95'
  const bodyClass = isDark
    ? 'bg-transparent'
    : 'bg-gradient-to-b from-white/80 to-slate-50/70'
  const fieldLabelClass = isDark ? 'text-slate-300' : 'text-slate-700'
  const fieldClass = isDark
    ? 'border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500'
    : 'border-slate-300/90 bg-slate-50/90 text-slate-800 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]'
  const secondaryButtonClass = isDark
    ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
    : 'border-slate-300/90 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
  const primaryButtonClass = isDark
    ? 'bg-white text-slate-900 hover:bg-slate-100'
    : 'bg-slate-900 text-white hover:bg-slate-800'
  const footerClass = isDark
    ? 'border-t border-slate-800/80 bg-slate-900/30'
    : 'border-t border-slate-200/80 bg-white/75'
  const subtleCardClass = isDark
    ? 'border-slate-800/80 bg-slate-900/35'
    : 'border-slate-200/80 bg-slate-50/85'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'complaint-modal-panel flex max-h-[calc(100vh-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[28px] p-0',
          panelClass,
        )}
      >
        <DialogHeader className={cn('px-6 py-6', headerClass)}>
          <DialogTitle id="complaint-modal-title" className="text-xl">
            {t('complaint.title')}
          </DialogTitle>
          <DialogDescription
            id="complaint-modal-description"
            className={cn(
              'mt-1 max-w-sm text-sm',
              isDark ? 'text-slate-500' : 'text-slate-600',
            )}
          >
            {t('complaint.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', bodyClass)}
        >
          {!isSignedIn ? (
            <div className="space-y-5">
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                {t('complaint.signInPrompt')}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/sign-in',
                      search: { redirect: complaintRedirect },
                    })
                  }
                  variant="outline"
                  className={cn('flex-1 rounded-2xl', secondaryButtonClass)}
                >
                  {t('header.signIn')}
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/sign-up',
                      search: { redirect: complaintRedirect },
                    })
                  }
                  className={cn('flex-1 rounded-2xl', primaryButtonClass)}
                >
                  {t('header.signUp')}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {formError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                  {formError}
                </div>
              )}

              <div className={cn('rounded-2xl border p-4', subtleCardClass)}>
                <div className="space-y-5">
                  <div>
                    <Label
                      className={cn(
                        'mb-2 block text-sm font-medium',
                        fieldLabelClass,
                      )}
                    >
                      {t('complaint.hotel')}
                    </Label>
                    <Select
                      value={selectedHotelId || '__none__'}
                      onValueChange={(value) =>
                        setValue('hotelId', value === '__none__' ? '' : value, {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger
                        className={cn('h-12 rounded-2xl', fieldClass)}
                      >
                        <SelectValue placeholder={t('complaint.selectHotel')} />
                      </SelectTrigger>
                      <SelectContent
                        className={cn(
                          isDark
                            ? 'border border-slate-800 bg-slate-900 text-slate-100'
                            : 'border border-slate-200 bg-white text-slate-900',
                        )}
                        position="popper"
                      >
                        <SelectItem value="__none__">
                          {t('complaint.selectHotel')}
                        </SelectItem>
                        {hotels.map((hotel) => (
                          <SelectItem key={hotel._id} value={hotel._id}>
                            {hotel.name} - {hotel.city}, {hotel.country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label
                      className={cn(
                        'mb-2 block text-sm font-medium',
                        fieldLabelClass,
                      )}
                    >
                      {t('complaint.bookingOptional')}
                    </Label>
                    <Select
                      value={selectedBookingId || '__none__'}
                      onValueChange={(value) =>
                        setValue(
                          'bookingId',
                          value === '__none__' ? '' : value,
                          {
                            shouldValidate: true,
                          },
                        )
                      }
                      disabled={
                        !selectedHotelId ||
                        bookingsForSelectedHotel.length === 0
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          'h-12 rounded-2xl disabled:opacity-50',
                          fieldClass,
                        )}
                      >
                        <SelectValue
                          placeholder={t('complaint.selectBooking')}
                        />
                      </SelectTrigger>
                      <SelectContent
                        className={cn(
                          isDark
                            ? 'border border-slate-800 bg-slate-900 text-slate-100'
                            : 'border border-slate-200 bg-white text-slate-900',
                        )}
                        position="popper"
                      >
                        <SelectItem value="__none__">
                          {t('complaint.selectBooking')}
                        </SelectItem>
                        {bookingsForSelectedHotel.map((booking) => (
                          <SelectItem key={booking._id} value={booking._id}>
                            {booking.checkIn} - {booking.checkOut} (
                            {statusLabel(booking.status)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label
                      className={cn(
                        'mb-2 block text-sm font-medium',
                        fieldLabelClass,
                      )}
                    >
                      {t('complaint.subject')}
                    </Label>
                    <Input
                      {...register('subject')}
                      type="text"
                      maxLength={120}
                      placeholder={t('complaint.subjectPlaceholder')}
                      className={cn('h-12 rounded-2xl', fieldClass)}
                    />
                  </div>

                  <div>
                    <Label
                      className={cn(
                        'mb-2 block text-sm font-medium',
                        fieldLabelClass,
                      )}
                    >
                      {t('complaint.description')}
                    </Label>
                    <Textarea
                      {...register('description')}
                      rows={5}
                      maxLength={2000}
                      placeholder={t('complaint.descriptionPlaceholder')}
                      className={cn(
                        'min-h-36 rounded-2xl resize-none',
                        fieldClass,
                      )}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {descriptionValue.length}/2000
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'flex flex-col gap-3 pt-1 sm:flex-row',
                  footerClass,
                )}
              >
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  className={cn('flex-1 rounded-2xl', secondaryButtonClass)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={complaintSaving}
                  className={cn(
                    'flex-1 rounded-2xl disabled:opacity-60',
                    primaryButtonClass,
                  )}
                >
                  {complaintSaving
                    ? t('complaint.submitting')
                    : t('complaint.submit')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
