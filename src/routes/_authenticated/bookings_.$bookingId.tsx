import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  CreditCard,
  Loader2,
  MapPin,
  RefreshCw,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../../../convex/_generated/api'
import { Button } from '../../components/ui/button'
import { useConfirm } from '../../components/ui/confirm-dialog'
import { useMutation, useQuery } from '../../integrations/convex/hooks'
import { formatUsdAmount } from '../../lib/currency'
import { useI18n } from '../../lib/i18n/provider'
import { getCustomerRefundView } from '../../lib/bookingStatus'
import {
  DEFAULT_HOTEL_DETAIL_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../../lib/navigationSearch'
import { canCustomerCancelBooking } from './bookings/components/-helpers'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/bookings_/$bookingId')({
  component: BookingCommandCenter,
})

const STATUS_ORDER = [
  'held',
  'pending_payment',
  'confirmed',
  'checked_in',
  'checked_out',
] as const

// Keep the remaining hold time visible so payment urgency is clear.
function useHoldCountdown(expiresAt?: number): string | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!expiresAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  if (!expiresAt) return null
  const remaining = Math.max(0, expiresAt - now)
  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function BookingCommandCenter() {
  const { bookingId } = Route.useParams()
  const { t } = useI18n()
  const confirm = useConfirm()
  const detail = useQuery(api.bookings.getEnriched, {
    bookingId: bookingId as Id<'bookings'>,
  })
  const cancelBooking = useMutation(api.bookings.cancelBooking)
  const [isCancelling, setIsCancelling] = useState(false)
  const [feedback, setFeedback] = useState<{
    message: string
    tone: 'error' | 'success'
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const countdown = useHoldCountdown(detail?.booking.holdExpiresAt)

  const reference = useMemo(
    () => bookingId.slice(-6).toUpperCase(),
    [bookingId],
  )

  if (detail === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-violet-400" />
      </div>
    )
  }

  if (detail === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center text-card-foreground">
          <h1 className="text-xl font-semibold text-foreground">
            {t('trip.notFoundTitle')}
          </h1>
          <p className="mt-2 text-muted-foreground">{t('trip.notFoundBody')}</p>
          <Button asChild className="mt-6">
            <Link to="/bookings">{t('trip.backToBookings')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  const { booking, hotel, room, payment } = detail
  const currentIndex = STATUS_ORDER.indexOf(
    booking.status as (typeof STATUS_ORDER)[number],
  )
  const canCancel = canCustomerCancelBooking(
    booking.status,
    booking.paymentStatus,
  )
  const canResumePayment = ['held', 'pending_payment'].includes(booking.status)
  const refundView = getCustomerRefundView(booking.refundStatus)
  const directionsUrl = hotel.location
    ? `https://www.google.com/maps/dir/?api=1&destination=${hotel.location.lat},${hotel.location.lng}`
    : null

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: t('booking.cancel'),
      description: t('bookings.confirmCancel'),
      confirmText: t('booking.cancel'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
    })
    if (!confirmed) return

    setIsCancelling(true)
    setFeedback(null)
    try {
      await cancelBooking({ bookingId: booking._id })
      setFeedback({ message: t('trip.cancelSuccess'), tone: 'success' })
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : t('bookings.cancelFailed'),
        tone: 'error',
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(reference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setFeedback({ message: t('trip.copyFailed'), tone: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link
          to="/bookings"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t('trip.backToBookings')}
        </Link>

        <section className="rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl shadow-slate-950/10 sm:p-8 dark:shadow-black/20">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-medium text-violet-400">
                {t('trip.commandCenter')}
              </p>
              <h1 className="mt-1 text-3xl font-semibold">{hotel.name}</h1>
              <p className="mt-2 flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4" /> {hotel.address}, {hotel.city}
              </p>
            </div>
            <button
              type="button"
              onClick={copyReference}
              className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground transition-colors hover:border-violet-500/50 hover:bg-accent"
            >
              {copied ? (
                <Check className="size-4 text-emerald-400" />
              ) : (
                <Copy className="size-4" />
              )}
              {t('trip.reference', { reference })}
            </button>
          </div>

          {countdown && canResumePayment && (
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-200">
              <span className="flex items-center gap-2 font-medium">
                <Clock3 className="size-5" /> {t('trip.holdRemaining')}
              </span>
              <span className="font-mono text-xl font-semibold">
                {countdown}
              </span>
            </div>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-5">
            {STATUS_ORDER.map((status, index) => {
              const complete = currentIndex >= index && currentIndex !== -1
              return (
                <div
                  key={status}
                  className="flex items-center gap-2 sm:flex-col sm:items-start"
                >
                  <div
                    className={`flex size-8 items-center justify-center rounded-full border ${complete ? 'border-violet-500 bg-violet-500 text-white' : 'border-border bg-muted text-muted-foreground'}`}
                  >
                    {complete ? <Check className="size-4" /> : index + 1}
                  </div>
                  <span
                    className={
                      complete
                        ? 'text-sm text-foreground'
                        : 'text-sm text-muted-foreground'
                    }
                  >
                    {t(`trip.timeline.${status}` as never)}
                  </span>
                </div>
              )
            })}
          </div>

          {['cancelled', 'expired', 'outsourced'].includes(booking.status) && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">
              <X className="size-4" />{' '}
              {t(`booking.status.${booking.status}` as never)}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground">
            <h2 className="text-lg font-semibold">{t('trip.stayDetails')}</h2>
            <dl className="mt-5 grid grid-cols-2 gap-5 text-sm">
              <div>
                <dt className="text-muted-foreground">
                  {t('booking.checkIn')}
                </dt>
                <dd className="mt-1 text-foreground">{booking.checkIn}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t('booking.checkOut')}
                </dt>
                <dd className="mt-1 text-foreground">{booking.checkOut}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('hotel.room')}</dt>
                <dd className="mt-1 text-foreground">
                  {room.roomNumber} · {room.type}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('booking.total')}</dt>
                <dd className="mt-1 font-semibold text-violet-400">
                  {formatUsdAmount(booking.totalPrice)}
                </dd>
              </div>
            </dl>
            {payment && (
              <div className="mt-5 rounded-xl border border-border bg-muted/60 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <CreditCard className="size-4 text-violet-400" />{' '}
                  {t('trip.paymentStatus')}
                </p>
                <p className="mt-2 capitalize text-muted-foreground">
                  {payment.status.replaceAll('_', ' ')}
                </p>
              </div>
            )}
            {refundView && (
              <div
                className={`mt-5 rounded-xl border p-4 text-sm ${
                  refundView === 'refunded'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                    : refundView === 'reversed'
                      ? 'border-red-500/30 bg-red-500/10 text-red-500'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-500'
                }`}
              >
                <p className="font-semibold">
                  {t(`refund.customer.label.${refundView}`)}
                </p>
                <p className="mt-1">{t(`refund.customer.${refundView}`)}</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground">
            <h2 className="text-lg font-semibold">{t('trip.actions')}</h2>
            <div className="mt-5 grid gap-3">
              {canResumePayment && (
                <Button
                  asChild
                  className="justify-start gap-2 bg-violet-600 hover:bg-violet-500"
                >
                  <Link
                    to="/hotels/$hotelId"
                    params={{ hotelId: hotel._id }}
                    search={{
                      ...DEFAULT_HOTEL_DETAIL_SEARCH,
                      resumeBookingId: booking._id,
                    }}
                  >
                    <CreditCard className="size-4" /> {t('trip.resumePayment')}
                  </Link>
                </Button>
              )}
              {directionsUrl && (
                <Button
                  asChild
                  variant="outline"
                  className="justify-start gap-2 border-border bg-background text-foreground hover:bg-muted"
                >
                  <a href={directionsUrl} target="_blank" rel="noreferrer">
                    <MapPin className="size-4" /> {t('trip.directions')}
                  </a>
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                className="justify-start gap-2 border-border bg-background text-foreground hover:bg-muted"
              >
                <Link
                  to="/hotels/$hotelId"
                  params={{ hotelId: hotel._id }}
                  search={DEFAULT_HOTEL_DETAIL_SEARCH}
                >
                  <RefreshCw className="size-4" /> {t('trip.bookAgain')}
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="justify-start gap-2 text-muted-foreground hover:text-foreground"
              >
                <Link
                  to="/select-location"
                  search={DEFAULT_SELECT_LOCATION_SEARCH}
                >
                  <CalendarDays className="size-4" />{' '}
                  {t('bookings.browseHotels')}
                </Link>
              </Button>
              {canCancel && (
                <Button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  variant="destructive"
                  className="justify-start gap-2"
                >
                  {isCancelling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                  {t('booking.cancel')}
                </Button>
              )}
            </div>
            {feedback && (
              <p
                role="status"
                className={`mt-4 rounded-xl border p-3 text-sm ${feedback.tone === 'success' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'}`}
              >
                {feedback.message}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
