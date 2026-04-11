import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'

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
import type { Id } from '../../../../convex/_generated/dataModel'

export interface ComplaintFormValues {
  hotelId: string
  subject: string
  description: string
  bookingId: string
}

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

function getFirstErrorMessage(errors: unknown[] | undefined): string | null {
  if (!errors) {
    return null
  }

  for (const error of errors) {
    if (!error) {
      continue
    }

    if (typeof error === 'string') {
      return error
    }

    if (typeof error === 'object' && 'message' in error) {
      const message = error.message
      if (typeof message === 'string') {
        return message
      }
    }
  }

  return null
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
      z.object({
        hotelId: z.string().min(1, t('complaint.validation.hotelRequired')),
        subject: z
          .string()
          .trim()
          .min(5, t('complaint.validation.subjectMin'))
          .max(120, t('complaint.validation.subjectMax')),
        description: z
          .string()
          .trim()
          .min(20, t('complaint.validation.descriptionMin'))
          .max(2000, t('complaint.validation.descriptionMax')),
        bookingId: z.string(),
      }),
    [t],
  )

  const form = useForm({
    defaultValues: {
      hotelId: '',
      subject: '',
      description: '',
      bookingId: '',
    } satisfies ComplaintFormValues,
    validators: {
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  const selectedHotelId = useStore(form.store, (state) => state.values.hotelId)
  const selectedBookingId = useStore(
    form.store,
    (state) => state.values.bookingId,
  )
  const descriptionValue = useStore(
    form.store,
    (state) => state.values.description,
  )

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
      form.setFieldValue('bookingId', '')
    }
  }, [bookingsForSelectedHotel, form, selectedBookingId])

  useEffect(() => {
    form.reset({
      hotelId: '',
      subject: '',
      description: '',
      bookingId: '',
    })
  }, [form])

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
  const footerClass = isDark
    ? 'border-t border-slate-800/80 bg-slate-900/30'
    : 'border-t border-slate-200/80 bg-white/75'
  const subtleCardClass = isDark
    ? 'border-slate-800/80 bg-slate-900/35'
    : 'border-slate-200/80 bg-slate-50/85'

  const hotelError = getFirstErrorMessage(form.getFieldMeta('hotelId')?.errors)
  const subjectError = getFirstErrorMessage(
    form.getFieldMeta('subject')?.errors,
  )
  const descriptionError = getFirstErrorMessage(
    form.getFieldMeta('description')?.errors,
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'complaint-modal-panel flex max-h-[calc(100vh-4rem)] w-full max-w-xl flex-col gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-2xl',
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
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/sign-in',
                      search: { redirect: complaintRedirect },
                    })
                  }
                  className="admin-button-secondary flex-1"
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
                  className="admin-button-primary flex-1"
                >
                  {t('header.signUp')}
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void form.handleSubmit()
              }}
              className="space-y-5"
            >
              {complaintError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                  {complaintError}
                </div>
              ) : null}

              <div className={cn('rounded-2xl border p-4', subtleCardClass)}>
                <div className="space-y-5">
                  <form.Field name="hotelId">
                    {(field) => (
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
                          value={field.state.value || '__none__'}
                          onValueChange={(value) =>
                            field.handleChange(
                              value === '__none__' ? '' : value,
                            )
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              'h-12 rounded-2xl',
                              fieldClass,
                              hotelError
                                ? 'border-red-500/60 focus:border-red-500/80'
                                : '',
                            )}
                            onBlur={field.handleBlur}
                          >
                            <SelectValue
                              placeholder={t('complaint.selectHotel')}
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
                              {t('complaint.selectHotel')}
                            </SelectItem>
                            {hotels.map((hotel) => (
                              <SelectItem key={hotel._id} value={hotel._id}>
                                {hotel.name} - {hotel.city}, {hotel.country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {hotelError ? (
                          <p className="mt-2 text-xs text-red-400">
                            {hotelError}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="bookingId">
                    {(field) => (
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
                          value={field.state.value || '__none__'}
                          onValueChange={(value) =>
                            field.handleChange(
                              value === '__none__' ? '' : value,
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
                            onBlur={field.handleBlur}
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
                                {booking.checkIn} - {booking.checkOut} ({' '}
                                {statusLabel(booking.status)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="subject">
                    {(field) => (
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
                          type="text"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={field.handleBlur}
                          maxLength={120}
                          placeholder={t('complaint.subjectPlaceholder')}
                          className={cn(
                            'h-12 rounded-2xl',
                            fieldClass,
                            subjectError
                              ? 'border-red-500/60 focus:border-red-500/80'
                              : '',
                          )}
                        />
                        {subjectError ? (
                          <p className="mt-2 text-xs text-red-400">
                            {subjectError}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="description">
                    {(field) => (
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
                          rows={5}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={field.handleBlur}
                          maxLength={2000}
                          placeholder={t('complaint.descriptionPlaceholder')}
                          className={cn(
                            'min-h-36 rounded-2xl resize-none',
                            fieldClass,
                            descriptionError
                              ? 'border-red-500/60 focus:border-red-500/80'
                              : '',
                          )}
                        />
                        {descriptionError ? (
                          <p className="mt-2 text-xs text-red-400">
                            {descriptionError}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500">
                          {descriptionValue.length}/2000
                        </p>
                      </div>
                    )}
                  </form.Field>
                </div>
              </div>

              <div
                className={cn(
                  'flex flex-col gap-3 border-t px-6 py-4 sm:flex-row',
                  footerClass,
                )}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="admin-button-secondary flex-1"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={complaintSaving}
                  className="admin-button-primary flex-1 disabled:opacity-60"
                >
                  {complaintSaving
                    ? t('complaint.submitting')
                    : t('complaint.submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
