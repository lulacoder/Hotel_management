import { Link } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import {
  Building2,
  Check,
  CheckCircle,
  Copy,
  CreditCard,
  Landmark,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'

import { api } from '../../../../convex/_generated/api'
import {
  uploadImageToConvex,
  validateImageFile,
} from '../../../lib/imageUpload'
import {
  PACKAGES,
  formatPackageAddOn,
  getPackageByType,
  getPackageDescription,
  getPackageInclusions,
  getPackageLabel,
} from '../../../lib/packages'
import { useI18n } from '../../../lib/i18n/provider'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { PackageType } from '../../../lib/packages'
import { useAction, useMutation, useQuery } from '@/integrations/convex/hooks'

interface BookingModalProps {
  roomId: Id<'rooms'>
  hotelId: Id<'hotels'>
  checkIn: string
  checkOut: string
  nights: number
  existingBooking?: {
    _id: Id<'bookings'>
    checkIn: string
    checkOut: string
    status: string
    pricePerNight: number
    totalPrice: number
    packageType?: PackageType | undefined
    packageAddOn?: number | undefined
  }
  onClose: () => void
  onSuccess: () => void
}

type PaymentMethod = '' | 'chapa' | 'bank'

interface BookingFormValues {
  packageType: PackageType
  guestName: string
  guestEmail: string
  specialRequests: string
  paymentMethod: PaymentMethod
  selectedBankAccountId: string
  nationalIdFile: File | null
  transactionId: string
}

function getFirstErrorMessage(
  errors: Array<unknown> | undefined,
): string | null {
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

export function BookingModal({
  roomId,
  hotelId,
  checkIn,
  checkOut,
  nights,
  existingBooking,
  onClose,
  onSuccess,
}: BookingModalProps) {
  const { user } = useUser()
  const { t } = useI18n()
  const room = useQuery(api.rooms.get, { roomId })
  const hotel = useQuery(api.hotels.get, { hotelId })
  const bankAccounts = useQuery(api.hotelBankAccounts.listByHotel, {
    hotelId,
  })
  const initializeChapaCheckout = useAction(
    api.chapaActions.initializeHostedCheckout,
  )
  const holdRoom = useMutation(api.bookings.holdRoom)
  const submitPaymentProof = useMutation(api.bookings.submitPaymentProof)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const trackUpload = useMutation(api.files.trackUpload)

  const [step, setStep] = useState<'package' | 'details' | 'confirm'>(
    existingBooking ? 'confirm' : 'package',
  )
  const [bookingId, setBookingId] = useState<Id<'bookings'> | null>(
    existingBooking?._id ?? null,
  )
  const [copied, setCopied] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<'hold' | 'bank' | null>(null)
  const [chapaLoading, setChapaLoading] = useState(false)
  const [error, setError] = useState('')

  const bookingSchema = useMemo(
    () =>
      z
        .object({
          packageType: z.enum(['room_only', 'with_breakfast', 'full_package']),
          guestName: z.string(),
          guestEmail: z.string(),
          specialRequests: z.string(),
          paymentMethod: z.enum(['', 'chapa', 'bank']),
          selectedBankAccountId: z.string(),
          nationalIdFile: z.custom<File | null>((value) => {
            if (value === null) {
              return true
            }

            if (typeof File === 'undefined') {
              return true
            }

            return value instanceof File
          }),
          transactionId: z.string(),
        })
        .superRefine((value, ctx) => {
          if (step === 'details') {
            if (!value.guestName.trim()) {
              ctx.addIssue({
                code: 'custom',
                path: ['guestName'],
                message: t('bookingModal.guestName'),
              })
            }

            if (!value.guestEmail.trim()) {
              ctx.addIssue({
                code: 'custom',
                path: ['guestEmail'],
                message: t('bookingModal.email'),
              })
            } else if (!z.email().safeParse(value.guestEmail.trim()).success) {
              ctx.addIssue({
                code: 'custom',
                path: ['guestEmail'],
                message: t('bookingModal.email'),
              })
            }
          }

          if (step === 'confirm' && value.paymentMethod === 'bank') {
            if (!value.selectedBankAccountId) {
              ctx.addIssue({
                code: 'custom',
                path: ['selectedBankAccountId'],
                message: t('bookingModal.selectBank'),
              })
            }

            if (!value.nationalIdFile) {
              ctx.addIssue({
                code: 'custom',
                path: ['nationalIdFile'],
                message: t('bookingModal.nationalIdRequired'),
              })
            } else {
              const fileError = validateImageFile(value.nationalIdFile)
              if (fileError) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['nationalIdFile'],
                  message: fileError,
                })
              }
            }

            if (!value.transactionId.trim()) {
              ctx.addIssue({
                code: 'custom',
                path: ['transactionId'],
                message: t('bookingModal.transactionIdRequired'),
              })
            }
          }
        }),
    [step, t],
  )

  const bookingDefaultValues: BookingFormValues = {
    packageType: existingBooking?.packageType ?? 'room_only',
    guestName: user?.fullName || '',
    guestEmail: user?.emailAddresses[0]?.emailAddress || '',
    specialRequests: '',
    paymentMethod: existingBooking?.status === 'pending_payment' ? 'bank' : '',
    selectedBankAccountId: '',
    nationalIdFile: null,
    transactionId: '',
  }

  const form = useForm({
    defaultValues: bookingDefaultValues,
    validators: {
      onBlur: bookingSchema,
      onSubmit: bookingSchema,
    },
    onSubmit: async ({ value }) => {
      if (!user?.id) {
        return
      }

      setError('')

      if (step === 'details') {
        setLoadingPhase('hold')

        try {
          const id = await holdRoom({
            roomId,
            checkIn,
            checkOut,
            packageType: value.packageType,
            packageAddOn: getPackageByType(value.packageType).addOnPerNight,
            guestName: value.guestName.trim(),
            guestEmail: value.guestEmail.trim(),
            specialRequests: value.specialRequests.trim() || undefined,
          })

          setBookingId(id)
          form.setFieldValue('paymentMethod', '')
          setStep('confirm')
        } catch (submissionError) {
          setError(
            submissionError instanceof Error
              ? submissionError.message
              : t('bookingModal.failedHold'),
          )
        } finally {
          setLoadingPhase(null)
        }

        return
      }

      if (step === 'confirm' && value.paymentMethod === 'bank' && bookingId) {
        setLoadingPhase('bank')

        try {
          const nationalIdStorageId = await uploadImageToConvex({
            file: value.nationalIdFile as File,
            generateUploadUrl,
            trackUpload,
          })

          await submitPaymentProof({
            bookingId,
            transactionId: value.transactionId.trim(),
            nationalIdStorageId,
          })

          setSubmitted(true)
        } catch (submissionError: any) {
          if (submissionError?.data?.code === 'EXPIRED') {
            setError(t('bookingModal.holdExpired'))
          } else {
            setError(
              submissionError instanceof Error
                ? submissionError.message
                : t('bookingModal.failedSubmitPaymentProof'),
            )
          }
        } finally {
          setLoadingPhase(null)
        }
      }
    },
  })

  const selectedPackageType = useStore(
    form.store,
    (state) => state.values.packageType,
  )
  const paymentMethod = useStore(
    form.store,
    (state) => state.values.paymentMethod,
  )
  const selectedBankAccountId = useStore(
    form.store,
    (state) => state.values.selectedBankAccountId,
  )
  const transactionId = useStore(
    form.store,
    (state) => state.values.transactionId,
  )
  const nationalIdFile = useStore(
    form.store,
    (state) => state.values.nationalIdFile,
  )

  useEffect(() => {
    if (!user) {
      return
    }

    if (!form.getFieldValue('guestName')) {
      form.setFieldValue('guestName', user.fullName || '')
    }

    if (!form.getFieldValue('guestEmail')) {
      form.setFieldValue(
        'guestEmail',
        user.emailAddresses[0]?.emailAddress || '',
      )
    }
  }, [form, user])

  useEffect(() => {
    if (!existingBooking) {
      return
    }

    form.setFieldValue(
      'packageType',
      existingBooking.packageType ?? 'room_only',
    )
    form.setFieldValue(
      'paymentMethod',
      existingBooking.status === 'pending_payment' ? 'bank' : '',
    )
    setBookingId(existingBooking._id)
    setStep('confirm')
  }, [existingBooking, form])

  useEffect(() => {
    if (!bankAccounts || bankAccounts.length === 0) {
      form.setFieldValue('selectedBankAccountId', '')
      return
    }

    if (selectedBankAccountId) {
      const stillExists = bankAccounts.some(
        (account) => account._id === selectedBankAccountId,
      )
      if (stillExists) {
        return
      }
    }

    form.setFieldValue('selectedBankAccountId', bankAccounts[0]._id)
  }, [bankAccounts, form, selectedBankAccountId])

  const handleChapaCheckout = async () => {
    if (!bookingId) {
      return
    }

    setChapaLoading(true)
    setError('')

    try {
      const result = await initializeChapaCheckout({ bookingId })

      if (!result.success || !result.checkoutUrl) {
        setError(result.error || t('bookingModal.chapaError'))
        return
      }

      window.location.assign(result.checkoutUrl)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t('bookingModal.chapaError'),
      )
    } finally {
      setChapaLoading(false)
    }
  }

  const selectedBankAccount = bankAccounts?.find(
    (account) => account._id === selectedBankAccountId,
  )

  const handleCopyBankAccount = async () => {
    if (!selectedBankAccount) {
      return
    }

    await navigator.clipboard.writeText(
      `${selectedBankAccount.bankName} - ${selectedBankAccount.accountNumber}`,
    )
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  if (!room || !hotel) {
    return null
  }

  const selectedPackage = getPackageByType(selectedPackageType)
  const bookingCheckIn = existingBooking?.checkIn ?? checkIn
  const bookingCheckOut = existingBooking?.checkOut ?? checkOut
  const roomRateCents = existingBooking?.pricePerNight ?? room.basePrice
  const packageRateCents =
    existingBooking?.packageAddOn ?? selectedPackage.addOnPerNight
  const roomSubtotalCents = roomRateCents * nights
  const packageSubtotalCents = packageRateCents * nights
  const totalPriceCents =
    existingBooking?.totalPrice ?? roomSubtotalCents + packageSubtotalCents

  const packageStepContent = (
    <div className="space-y-3">
      {PACKAGES.map((pkg) => {
        const isSelected = pkg.type === selectedPackageType

        return (
          <button
            key={pkg.type}
            type="button"
            onClick={() => form.setFieldValue('packageType', pkg.type)}
            className={`booking-package-card light-hover-surface w-full cursor-pointer rounded-xl border p-4 text-left transition-all ${
              isSelected
                ? 'booking-package-card--selected border-violet-500/50 bg-violet-500/10'
                : 'booking-package-card--idle border-slate-700 bg-slate-800/40 hover:border-slate-600'
            }`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="booking-package-title font-semibold text-slate-100">
                  {getPackageLabel(pkg.type, t)}
                </p>
                <p className="booking-package-description text-sm text-slate-400">
                  {getPackageDescription(pkg.type, t)}
                </p>
              </div>
              <span
                className={`booking-package-badge rounded-full border px-2.5 py-1 text-xs font-medium ${
                  isSelected
                    ? 'booking-package-badge--selected border-violet-500/40 bg-violet-500/10 text-violet-300'
                    : 'border-slate-600 bg-slate-700/40 text-slate-300'
                }`}
              >
                {formatPackageAddOn(pkg.addOnPerNight, t)}
              </span>
            </div>

            <ul className="booking-package-inclusions list-inside list-disc space-y-0.5 text-sm text-slate-400">
              {getPackageInclusions(pkg.type, t).map((item) => (
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
          className="booking-action-secondary flex-1 cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={() => setStep('details')}
          className="booking-action-primary flex-1 cursor-pointer rounded-xl bg-white px-4 py-3 font-medium text-slate-900 transition-all hover:bg-slate-100"
        >
          {t('bookingModal.continue')}
        </button>
      </div>
    </div>
  )

  const detailsStepContent = (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
      className="space-y-4"
    >
      <form.Field name="guestName">
        {(field) => {
          const fieldError = getFirstErrorMessage(field.state.meta.errors)

          return (
            <div>
              <label className="booking-field-label mb-2 block text-sm font-medium text-slate-300">
                {t('bookingModal.guestName')}
              </label>
              <input
                aria-label={t('bookingModal.guestName')}
                type="text"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                className={`booking-input w-full rounded-xl border bg-slate-800/50 px-4 py-3 text-slate-200 transition-all focus:border-violet-500/50 focus:outline-none ${
                  fieldError
                    ? 'border-red-500/60 focus:border-red-500/80'
                    : 'border-slate-700'
                }`}
              />
              {fieldError ? (
                <p className="mt-2 text-xs text-red-400">{fieldError}</p>
              ) : null}
            </div>
          )
        }}
      </form.Field>

      <form.Field name="guestEmail">
        {(field) => {
          const fieldError = getFirstErrorMessage(field.state.meta.errors)

          return (
            <div>
              <label className="booking-field-label mb-2 block text-sm font-medium text-slate-300">
                {t('bookingModal.email')}
              </label>
              <input
                aria-label={t('bookingModal.email')}
                type="email"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                className={`booking-input w-full rounded-xl border bg-slate-800/50 px-4 py-3 text-slate-200 transition-all focus:border-violet-500/50 focus:outline-none ${
                  fieldError
                    ? 'border-red-500/60 focus:border-red-500/80'
                    : 'border-slate-700'
                }`}
              />
              {fieldError ? (
                <p className="mt-2 text-xs text-red-400">{fieldError}</p>
              ) : null}
            </div>
          )
        }}
      </form.Field>

      <form.Field name="specialRequests">
        {(field) => (
          <div>
            <label className="booking-field-label mb-2 block text-sm font-medium text-slate-300">
              {t('bookingModal.specialRequests')}
            </label>
            <textarea
              aria-label={t('bookingModal.specialRequests')}
              rows={3}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              placeholder={t('bookingModal.specialRequestsPlaceholder')}
              className="booking-input booking-textarea w-full resize-none rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-200 placeholder-slate-500 transition-all focus:border-violet-500/50 focus:outline-none"
            />
          </div>
        )}
      </form.Field>

      <div className="booking-hold-notice-card rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
        <p className="booking-hold-notice-text text-base font-medium text-violet-400">
          {t('bookingModal.holdNotice')}
        </p>
      </div>

      <div className="booking-price-card rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-sm">
        <div className="flex items-center justify-between text-slate-300">
          <span>
            {t('bookingModal.roomRate')} ({nights}{' '}
            {nights !== 1 ? t('hotel.nights') : t('hotel.night')})
          </span>
          <span>${(roomSubtotalCents / 100).toFixed(2)}</span>
        </div>
        {selectedPackage.addOnPerNight > 0 ? (
          <div className="mt-2 flex items-center justify-between text-slate-300">
            <span>
              {getPackageLabel(selectedPackage.type, t)}{' '}
              {t('bookingModal.addOn')} ({nights}{' '}
              {nights !== 1 ? t('hotel.nights') : t('hotel.night')})
            </span>
            <span>${(packageSubtotalCents / 100).toFixed(2)}</span>
          </div>
        ) : null}
        <div className="booking-details-total mt-3 flex items-center justify-between border-t border-slate-700 pt-3 font-semibold text-violet-400">
          <span>{t('booking.total')}</span>
          <span>${(totalPriceCents / 100).toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => setStep('package')}
          className="booking-action-secondary flex-1 cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          {t('signIn.back')}
        </button>
        <button
          type="submit"
          disabled={loadingPhase === 'hold'}
          className="booking-action-primary flex-1 cursor-pointer rounded-xl bg-white px-4 py-3 font-medium text-slate-900 transition-all hover:bg-slate-100 disabled:opacity-50"
        >
          {loadingPhase === 'hold'
            ? t('bookingModal.holding')
            : t('bookingModal.holdRoom')}
        </button>
      </div>
    </form>
  )

  const confirmationContent = submitted ? (
    <div className="space-y-4">
      <div className="booking-success-card rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
        <div className="mb-2 flex items-center gap-2 text-emerald-400">
          <CheckCircle className="size-5" />
          <span className="font-semibold">
            {t('bookingModal.paymentProofSubmitted')}
          </span>
        </div>
        <p className="text-sm text-slate-300">
          {t('bookingModal.awaitingVerification')}
        </p>
      </div>

      {bookingId ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-sm">
          <p className="mb-1 text-slate-500">{t('bookingModal.bookingId')}</p>
          <p className="font-medium text-slate-200">{bookingId}</p>
        </div>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="booking-action-secondary flex-1 cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          {t('common.close')}
        </button>
        <Link
          to="/bookings"
          search={{
            payment: undefined,
            tx_ref: undefined,
          }}
          onClick={onSuccess}
          className="booking-action-success flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-center font-medium text-white transition-all hover:from-emerald-600 hover:to-emerald-700"
        >
          {t('bookingModal.viewMyBookings')}
        </Link>
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      <div className="booking-success-card rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
        <div className="mb-2 flex items-center gap-2 text-emerald-400">
          <CheckCircle className="size-5" />
          <span className="font-semibold">{t('bookingModal.heldSuccess')}</span>
        </div>
        <p className="text-sm text-slate-400">
          {t('bookingModal.heldDescription')}
        </p>
      </div>

      <div className="booking-price-card rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-sm">
        <div className="flex items-center justify-between text-slate-300">
          <span>
            {t('bookingModal.roomRate')} ({nights}{' '}
            {nights !== 1 ? t('hotel.nights') : t('hotel.night')})
          </span>
          <span>${(roomSubtotalCents / 100).toFixed(2)}</span>
        </div>
        {packageRateCents > 0 ? (
          <div className="mt-2 flex items-center justify-between text-slate-300">
            <span>
              {getPackageLabel(selectedPackage.type, t)}{' '}
              {t('bookingModal.addOn')} ({nights}{' '}
              {nights !== 1 ? t('hotel.nights') : t('hotel.night')})
            </span>
            <span>${(packageSubtotalCents / 100).toFixed(2)}</span>
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-3 font-semibold text-emerald-400">
          <span>{t('booking.total')}</span>
          <span>${(totalPriceCents / 100).toFixed(2)}</span>
        </div>
      </div>

      {!paymentMethod ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-300">
            {t('bookingModal.selectPaymentMethod')}
          </p>

          <button
            type="button"
            onClick={() => form.setFieldValue('paymentMethod', 'chapa')}
            className="booking-payment-option booking-payment-option--chapa w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/10"
          >
            <div className="mb-1 flex items-center gap-3 text-slate-100">
              <CreditCard className="booking-payment-option-icon size-5 text-violet-400" />
              <span className="booking-payment-option-title font-semibold">
                {t('bookingModal.payWithChapa')}
              </span>
            </div>
            <p className="booking-payment-option-description text-sm text-slate-400">
              {t('bookingModal.chapaDescription')}
            </p>
          </button>

          <button
            type="button"
            onClick={() => form.setFieldValue('paymentMethod', 'bank')}
            className="booking-payment-option booking-payment-option--bank w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-left transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10"
          >
            <div className="mb-1 flex items-center gap-3 text-slate-100">
              <Landmark className="booking-payment-option-icon size-5 text-emerald-400" />
              <span className="booking-payment-option-title font-semibold">
                {t('bookingModal.payWithBank')}
              </span>
            </div>
            <p className="booking-payment-option-description text-sm text-slate-400">
              {t('bookingModal.bankDescription')}
            </p>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="booking-action-secondary w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-700"
          >
            {t('bookingModal.cancelHold')}
          </button>
        </div>
      ) : null}

      {paymentMethod === 'chapa' ? (
        <div className="space-y-4">
          <div className="booking-chapa-notice rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
            <p className="booking-chapa-notice-title text-sm font-medium text-violet-300">
              {t('bookingModal.chapaRedirectNotice')}
            </p>
            <p className="booking-chapa-notice-body mt-2 text-xs text-violet-200/80">
              {t('bookingModal.chapaProcessingNotice')}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => form.setFieldValue('paymentMethod', '')}
              className="booking-action-secondary flex-1 cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-700"
            >
              {t('signIn.back')}
            </button>
            <button
              type="button"
              onClick={handleChapaCheckout}
              disabled={chapaLoading}
              className="booking-action-primary flex-1 cursor-pointer rounded-xl bg-white px-4 py-3 font-medium text-slate-900 transition-all hover:bg-slate-100 disabled:opacity-50"
            >
              {chapaLoading
                ? t('bookingModal.redirectingToChapa')
                : t('bookingModal.proceedToChapa')}
            </button>
          </div>
        </div>
      ) : null}

      {paymentMethod === 'bank' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          <div>
            <p className="mb-2 text-sm text-slate-400">
              {t('bookingModal.transferTo')}
            </p>
            <div className="space-y-3">
              <form.Field name="selectedBankAccountId">
                {(field) => {
                  const fieldError = getFirstErrorMessage(
                    field.state.meta.errors,
                  )

                  return (
                    <div>
                      <label className="booking-field-label mb-2 block text-xs text-slate-500">
                        {t('bookingModal.selectBank')}
                      </label>
                      <select
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        onBlur={field.handleBlur}
                        disabled={!bankAccounts || bankAccounts.length === 0}
                        className={`booking-input booking-select w-full rounded-xl border bg-slate-800/60 px-3 py-2.5 text-slate-200 transition-all focus:border-violet-500/50 focus:outline-none ${
                          fieldError
                            ? 'border-red-500/60 focus:border-red-500/80'
                            : 'border-slate-700'
                        }`}
                      >
                        {bankAccounts && bankAccounts.length > 0 ? (
                          bankAccounts.map((account) => (
                            <option key={account._id} value={account._id}>
                              {account.bankName} - {account.accountNumber}
                            </option>
                          ))
                        ) : (
                          <option value="">
                            {t('bookingModal.paymentNotConfigured')}
                          </option>
                        )}
                      </select>
                      {fieldError ? (
                        <p className="mt-2 text-xs text-red-400">
                          {fieldError}
                        </p>
                      ) : null}
                    </div>
                  )
                }}
              </form.Field>

              <div className="booking-bank-card flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-3">
                <div>
                  <p className="mb-1 text-xs text-slate-500">
                    {t('bookingModal.bankAccountNumber')}
                  </p>
                  <p className="break-all font-semibold text-slate-100">
                    {selectedBankAccount
                      ? `${selectedBankAccount.bankName} - ${selectedBankAccount.accountNumber}`
                      : t('bookingModal.paymentNotConfigured')}
                  </p>
                </div>
                {selectedBankAccount ? (
                  <button
                    type="button"
                    onClick={handleCopyBankAccount}
                    className="booking-copy-button inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copied ? t('common.copied') : t('common.copy')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <form.Field name="nationalIdFile">
            {(field) => {
              const fieldError = getFirstErrorMessage(field.state.meta.errors)

              return (
                <div>
                  <label className="booking-field-label mb-2 block text-sm font-medium text-slate-300">
                    {t('bookingModal.uploadNationalId')}
                  </label>
                  <input
                    aria-label={t('bookingModal.uploadNationalId')}
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      field.handleChange(event.target.files?.[0] ?? null)
                    }
                    onBlur={field.handleBlur}
                    className={`booking-input booking-file-input w-full rounded-xl border bg-slate-800/50 px-4 py-3 text-slate-200 transition-all file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100 hover:file:bg-slate-600 focus:border-violet-500/50 focus:outline-none ${
                      fieldError
                        ? 'border-red-500/60 focus:border-red-500/80'
                        : 'border-slate-700'
                    }`}
                  />
                  {nationalIdFile ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {nationalIdFile.name}
                    </p>
                  ) : null}
                  {fieldError ? (
                    <p className="mt-2 text-xs text-red-400">{fieldError}</p>
                  ) : null}
                </div>
              )
            }}
          </form.Field>

          <form.Field name="transactionId">
            {(field) => {
              const fieldError = getFirstErrorMessage(field.state.meta.errors)

              return (
                <div>
                  <label className="booking-field-label mb-2 block text-sm font-medium text-slate-300">
                    {t('bookingModal.transactionId')}
                  </label>
                  <input
                    aria-label={t('bookingModal.transactionId')}
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('bookingModal.transactionIdPlaceholder')}
                    className={`booking-input w-full rounded-xl border bg-slate-800/50 px-4 py-3 text-slate-200 placeholder-slate-500 transition-all focus:border-violet-500/50 focus:outline-none ${
                      fieldError
                        ? 'border-red-500/60 focus:border-red-500/80'
                        : 'border-slate-700'
                    }`}
                  />
                  {fieldError ? (
                    <p className="mt-2 text-xs text-red-400">{fieldError}</p>
                  ) : null}
                </div>
              )
            }}
          </form.Field>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => form.setFieldValue('paymentMethod', '')}
              className="booking-action-secondary flex-1 cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-700"
            >
              {t('signIn.back')}
            </button>
            <button
              type="submit"
              disabled={
                loadingPhase === 'bank' ||
                !nationalIdFile ||
                !transactionId.trim() ||
                !selectedBankAccount
              }
              className="booking-action-success flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 font-medium text-white transition-all hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50"
            >
              {loadingPhase === 'bank'
                ? t('bookingModal.submittingPaymentProof')
                : t('bookingModal.submitPaymentProof')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )

  const stepCopy = (() => {
    if (step === 'package') {
      return {
        title: t('bookingModal.step.packageTitle'),
        description: t('bookingModal.step.packageDescription'),
      }
    }

    if (step === 'details') {
      return {
        title: t('bookingModal.step.detailsTitle'),
        description: t('bookingModal.step.detailsDescription'),
      }
    }

    if (submitted) {
      return {
        title: t('bookingModal.step.submittedTitle'),
        description: t('bookingModal.step.submittedDescription'),
      }
    }

    return {
      title: t('bookingModal.step.paymentTitle'),
      description: t('bookingModal.step.paymentDescription'),
    }
  })()

  const stepContent = (() => {
    if (step === 'package') {
      return packageStepContent
    }

    if (step === 'details') {
      return detailsStepContent
    }

    return confirmationContent
  })()

  return (
    <div className="booking-modal fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="booking-modal-panel flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="booking-modal-header shrink-0 border-b border-slate-800 p-4 sm:p-5">
          <h2 className="booking-modal-title text-xl font-semibold text-slate-100">
            {stepCopy.title}
          </h2>
          <p className="booking-modal-subtitle mt-1 text-sm text-slate-500">
            {stepCopy.description}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 overscroll-contain scroll-smooth sm:p-5">
          <div className="booking-summary-card mb-4 rounded-xl bg-slate-800/50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="booking-summary-icon-wrap flex size-12 items-center justify-center rounded-lg bg-slate-700">
                <Building2 className="booking-summary-icon size-6 text-slate-400" />
              </div>
              <div>
                <p className="booking-summary-hotel font-semibold text-slate-200">
                  {hotel.name}
                </p>
                <p className="booking-summary-room text-sm text-slate-400">
                  {t('hotel.room')} {room.roomNumber} - {room.type}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="booking-summary-label text-slate-500">
                  {t('booking.checkIn')}
                </p>
                <p className="booking-summary-value text-slate-200">
                  {bookingCheckIn}
                </p>
              </div>
              <div>
                <p className="booking-summary-label text-slate-500">
                  {t('booking.checkOut')}
                </p>
                <p className="booking-summary-value text-slate-200">
                  {bookingCheckOut}
                </p>
              </div>
            </div>
            <div className="booking-summary-total mt-4 flex justify-between border-t border-slate-700 pt-4">
              <div className="text-sm text-slate-400">
                <p>
                  {t('hotel.room')}: ${(roomRateCents / 100).toFixed(0)} ×{' '}
                  {nights} {nights !== 1 ? t('hotel.nights') : t('hotel.night')}
                </p>
                {packageRateCents > 0 ? (
                  <p>
                    {t('booking.package')}: $
                    {(packageRateCents / 100).toFixed(0)} × {nights}
                  </p>
                ) : null}
              </div>
              <span className="booking-summary-total-amount text-xl font-bold text-violet-400">
                ${(totalPriceCents / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {error ? (
            <div className="booking-modal-error mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          {stepContent}
        </div>
      </div>
    </div>
  )
}
