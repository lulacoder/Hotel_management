// Booking confirmation modal for selecting guest details and creating reservations.
import { Link } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { Building2, Check, CheckCircle, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { uploadImageToConvex, validateImageFile } from '../../../lib/imageUpload'
import {
  PACKAGES,
  formatPackageAddOn,
  getPackageByType,
  getPackageDescription,
  getPackageInclusions,
  getPackageLabel,
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
  // Fetch room/hotel context and manage a 3-step booking flow in local state.
  const { user } = useUser()
  const { t } = useI18n()
  const room = useQuery(api.rooms.get, { roomId })
  const hotel = useQuery(api.hotels.get, { hotelId })
  const bankAccounts = useQuery(api.hotelBankAccounts.listByHotel, {
    hotelId,
  })
  const holdRoom = useMutation(api.bookings.holdRoom)
  const submitPaymentProof = useMutation(api.bookings.submitPaymentProof)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const trackUpload = useMutation(api.files.trackUpload)

  const [step, setStep] = useState<'package' | 'details' | 'confirm'>(
    existingBooking ? 'confirm' : 'package',
  )
  const [selectedPackageType, setSelectedPackageType] = useState<PackageType>(
    existingBooking?.packageType ?? 'room_only',
  )
  const [guestDetails, setGuestDetails] = useState({
    guestName: user?.fullName || '',
    guestEmail: user?.emailAddresses[0]?.emailAddress || '',
    specialRequests: '',
  })
  const [bookingId, setBookingId] = useState<Id<'bookings'> | null>(
    existingBooking?._id ?? null,
  )
  const [nationalIdFile, setNationalIdFile] = useState<File | null>(null)
  const [transactionId, setTransactionId] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<
    Id<'hotelBankAccounts'> | ''
  >('')

  useEffect(() => {
    if (!user) return

    setGuestDetails((prev) => ({
      ...prev,
      guestName: prev.guestName || user.fullName || '',
      guestEmail: prev.guestEmail || user.emailAddresses[0]?.emailAddress || '',
    }))
  }, [user])

  useEffect(() => {
    if (!existingBooking) return

    setSelectedPackageType(existingBooking.packageType ?? 'room_only')
    setBookingId(existingBooking._id)
    setStep('confirm')
  }, [existingBooking])

  useEffect(() => {
    if (!bankAccounts || bankAccounts.length === 0) {
      setSelectedBankAccountId('')
      return
    }

    if (selectedBankAccountId) {
      const stillExists = bankAccounts.some(
        (account) => account._id === selectedBankAccountId,
      )
      if (stillExists) return
    }

    setSelectedBankAccountId(bankAccounts[0]._id)
  }, [bankAccounts, selectedBankAccountId])

  const handleHold = async (e: React.FormEvent) => {
    // Step 1 submission: place temporary hold with package + guest details.
    e.preventDefault()
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      const id = await holdRoom({
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

  const handleSubmitPaymentProof = async () => {
    // Step 3 confirmation: submit payment proof and move booking to pending verification.
    if (!user?.id || !bookingId) return
    if (!nationalIdFile) {
      setError(t('bookingModal.nationalIdRequired'))
      return
    }

    const fileError = validateImageFile(nationalIdFile)
    if (fileError) {
      setError(fileError)
      return
    }

    const trimmedTransactionId = transactionId.trim()
    if (!trimmedTransactionId) {
      setError(t('bookingModal.transactionIdRequired'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const nationalIdStorageId = await uploadImageToConvex({
        file: nationalIdFile,
        generateUploadUrl,
        trackUpload,
      })

      await submitPaymentProof({
        bookingId,
        transactionId: trimmedTransactionId,
        nationalIdStorageId,
      })

      setSubmitted(true)
    } catch (err: any) {
      if (err?.data?.code === 'EXPIRED') {
        setError(t('bookingModal.holdExpired'))
      } else {
        setError(err.message || t('bookingModal.failedSubmitPaymentProof'))
      }
    } finally {
      setLoading(false)
    }
  }

  const selectedBankAccount = bankAccounts?.find(
    (account) => account._id === selectedBankAccountId,
  )

  const handleCopyBankAccount = async () => {
    if (!selectedBankAccount) return

    await navigator.clipboard.writeText(
      `${selectedBankAccount.bankName} — ${selectedBankAccount.accountNumber}`,
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
  const totalPriceCents = existingBooking?.totalPrice ?? roomSubtotalCents + packageSubtotalCents

  return (
    <div className="booking-modal fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="booking-modal-panel bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="booking-modal-header p-4 sm:p-5 border-b border-slate-800 shrink-0">
          <h2 className="booking-modal-title text-xl font-semibold text-slate-100">
            {step === 'package'
              ? t('bookingModal.step.packageTitle')
              : step === 'details'
                ? t('bookingModal.step.detailsTitle')
                : submitted
                  ? t('bookingModal.step.submittedTitle')
                  : t('bookingModal.step.paymentTitle')}
          </h2>
          <p className="booking-modal-subtitle text-sm text-slate-500 mt-1">
            {step === 'package'
              ? t('bookingModal.step.packageDescription')
              : step === 'details'
                ? t('bookingModal.step.detailsDescription')
                : submitted
                  ? t('bookingModal.step.submittedDescription')
                  : t('bookingModal.step.paymentDescription')}
          </p>
        </div>

        <div className="p-4 sm:p-5 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
          <div className="booking-summary-card bg-slate-800/50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="booking-summary-icon-wrap w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                <Building2 className="booking-summary-icon w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="booking-summary-hotel font-semibold text-slate-200">{hotel.name}</p>
                <p className="booking-summary-room text-sm text-slate-400">
                  {t('hotel.room')} {room.roomNumber} - {room.type}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="booking-summary-label text-slate-500">{t('booking.checkIn')}</p>
                <p className="booking-summary-value text-slate-200">{bookingCheckIn}</p>
              </div>
              <div>
                <p className="booking-summary-label text-slate-500">{t('booking.checkOut')}</p>
                <p className="booking-summary-value text-slate-200">{bookingCheckOut}</p>
              </div>
            </div>
            <div className="booking-summary-total border-t border-slate-700 mt-4 pt-4 flex justify-between">
              <div className="text-slate-400 text-sm">
                <p>
                  {t('hotel.room')}: ${(roomRateCents / 100).toFixed(0)} ×{' '}
                  {nights} {nights !== 1 ? t('hotel.nights') : t('hotel.night')}
                </p>
                {packageRateCents > 0 && (
                  <p>
                    {t('booking.package')}: $
                    {(packageRateCents / 100).toFixed(0)} ×{' '}
                    {nights}
                  </p>
                )}
              </div>
              <span className="booking-summary-total-amount text-xl font-bold text-blue-400">
                ${(totalPriceCents / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {error && (
            <div className="booking-modal-error bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-4">
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
                    className={`booking-package-card light-hover-surface w-full text-left rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'booking-package-card--selected border-blue-500/50 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-slate-100 font-semibold">
                          {getPackageLabel(pkg.type, t)}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {getPackageDescription(pkg.type, t)}
                        </p>
                      </div>
                      <span
                        className={`booking-package-badge text-xs font-medium px-2.5 py-1 rounded-full border ${
                          isSelected
                            ? 'booking-package-badge--selected text-blue-300 border-blue-500/40 bg-blue-500/10'
                            : 'text-slate-300 border-slate-600 bg-slate-700/40'
                        }`}
                      >
                        {formatPackageAddOn(pkg.addOnPerNight, t)}
                      </span>
                    </div>

                    <ul className="booking-package-inclusions list-disc list-inside text-sm text-slate-400 space-y-0.5">
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
                  className="booking-action-secondary flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="booking-action-primary flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all"
                >
                  {t('bookingModal.continue')}
                </button>
              </div>
            </div>
          ) : step === 'details' ? (
            <form onSubmit={handleHold} className="space-y-4">
              <div>
                <label className="booking-field-label block text-sm font-medium text-slate-300 mb-2">
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
                  className="booking-input w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              <div>
                <label className="booking-field-label block text-sm font-medium text-slate-300 mb-2">
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
                  className="booking-input w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              <div>
                <label className="booking-field-label block text-sm font-medium text-slate-300 mb-2">
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
                  className="booking-input booking-textarea w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
              </div>

              <div className="booking-hold-notice-card bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="booking-hold-notice-text text-blue-400 text-base font-medium">
                  {t('bookingModal.holdNotice')}
                </p>
              </div>

              <div className="booking-price-card bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-sm">
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
                      {getPackageLabel(selectedPackage.type, t)}{' '}
                      {t('bookingModal.addOn')} (
                      {nights}{' '}
                      {nights !== 1 ? t('hotel.nights') : t('hotel.night')})
                    </span>
                    <span>${(packageSubtotalCents / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="booking-details-total border-t border-slate-700 mt-3 pt-3 flex items-center justify-between text-blue-400 font-semibold">
                  <span>{t('booking.total')}</span>
                  <span>${(totalPriceCents / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('package')}
                  className="booking-action-secondary flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  {t('signIn.back')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="booking-action-primary flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
                >
                  {loading
                    ? t('bookingModal.holding')
                    : t('bookingModal.holdRoom')}
                </button>
              </div>
            </form>
          ) : submitted ? (
            <div className="space-y-4">
              <div className="booking-success-card bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">
                    {t('bookingModal.paymentProofSubmitted')}
                  </span>
                </div>
                <p className="text-slate-300 text-sm">
                  {t('bookingModal.awaitingVerification')}
                </p>
              </div>

              {bookingId && (
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-sm">
                  <p className="text-slate-500 mb-1">{t('bookingModal.bookingId')}</p>
                  <p className="text-slate-200 font-medium">{bookingId}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="booking-action-secondary flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  {t('common.close')}
                </button>
                <Link
                  to="/bookings"
                  onClick={onSuccess}
                  className="booking-action-success flex-1 px-4 py-3 text-center bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all"
                >
                  {t('bookingModal.viewMyBookings')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="booking-success-card bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
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

              <div className="booking-price-card bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>
                    {t('bookingModal.roomRate')} ({nights}{' '}
                    {nights !== 1 ? t('hotel.nights') : t('hotel.night')})
                  </span>
                  <span>${(roomSubtotalCents / 100).toFixed(2)}</span>
                </div>
                {packageRateCents > 0 && (
                  <div className="flex items-center justify-between text-slate-300 mt-2">
                    <span>
                      {getPackageLabel(selectedPackage.type, t)}{' '}
                      {t('bookingModal.addOn')} (
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

              <div>
                <p className="text-sm text-slate-400 mb-2">
                  {t('bookingModal.transferTo')}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="booking-field-label block text-xs text-slate-500 mb-2">
                      {t('bookingModal.selectBank')}
                    </label>
                    <select
                      value={selectedBankAccountId}
                      onChange={(e) =>
                        setSelectedBankAccountId(
                          e.target.value as Id<'hotelBankAccounts'>,
                        )
                      }
                      disabled={!bankAccounts || bankAccounts.length === 0}
                      className="booking-input booking-select w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
                    >
                      {bankAccounts && bankAccounts.length > 0 ? (
                        bankAccounts.map((account) => (
                          <option key={account._id} value={account._id}>
                            {account.bankName} — {account.accountNumber}
                          </option>
                        ))
                      ) : (
                        <option value="">
                          {t('bookingModal.paymentNotConfigured')}
                        </option>
                      )}
                    </select>
                  </div>

                  <div className="booking-bank-card flex items-center justify-between gap-2 bg-slate-800/40 border border-slate-700 rounded-xl p-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">
                        {t('bookingModal.bankAccountNumber')}
                      </p>
                      <p className="text-slate-100 font-semibold break-all">
                        {selectedBankAccount
                          ? `${selectedBankAccount.bankName} — ${selectedBankAccount.accountNumber}`
                          : t('bookingModal.paymentNotConfigured')}
                      </p>
                    </div>
                    {selectedBankAccount && (
                      <button
                        type="button"
                        onClick={handleCopyBankAccount}
                        className="booking-copy-button inline-flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 text-sm"
                      >
                        {copied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {copied ? t('common.copied') : t('common.copy')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="booking-field-label block text-sm font-medium text-slate-300 mb-2">
                  {t('bookingModal.uploadNationalId')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    setNationalIdFile(file)
                  }}
                  className="booking-input booking-file-input w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-slate-700 file:text-slate-100 hover:file:bg-slate-600"
                />
              </div>

              <div>
                <label className="booking-field-label block text-sm font-medium text-slate-300 mb-2">
                  {t('bookingModal.transactionId')}
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder={t('bookingModal.transactionIdPlaceholder')}
                  className="booking-input w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="booking-action-secondary flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  {t('bookingModal.cancelHold')}
                </button>
                <button
                  onClick={handleSubmitPaymentProof}
                  disabled={
                    loading ||
                    !nationalIdFile ||
                    !transactionId.trim() ||
                    !selectedBankAccount
                  }
                  className="booking-action-success flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50"
                >
                  {loading
                    ? t('bookingModal.submittingPaymentProof')
                    : t('bookingModal.submitPaymentProof')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
