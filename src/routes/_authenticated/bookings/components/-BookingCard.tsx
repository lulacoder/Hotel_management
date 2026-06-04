// Presentational card for a single booking item in the customer bookings list.
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  BedDouble,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  X,
  XCircle,
} from 'lucide-react'

import { Badge } from '../../../../components/ui/badge'
import { Button } from '../../../../components/ui/button'
import { Card, CardContent } from '../../../../components/ui/card'
import {
  formatPackageAddOn,
  getPackageLabelOrDefault,
} from '../../../../lib/packages'
import { useI18n } from '../../../../lib/i18n/provider'
import { canCancel, formatDate, formatPrice, formatTime } from './-helpers'
import type { Id } from '../../../../../convex/_generated/dataModel'
import type { PackageType } from '../../../../lib/packages'

interface BookingCardProps {
  booking: {
    _id: Id<'bookings'>
    checkIn: string
    checkOut: string
    pricePerNight: number
    totalPrice: number
    status: string
    holdExpiresAt?: number | undefined
    packageType?: PackageType | undefined
    packageAddOn?: number | undefined
  }
  room: {
    _id: Id<'rooms'>
    roomNumber: string
    type: string
  }
  hotel: {
    _id: Id<'hotels'>
    name: string
    address: string
    city: string
  }
  cancellingId: string | null
  onCancel: (bookingId: Id<'bookings'>) => void
}

function StatusBadge({ status }: { status: string }) {
  // Centralize visual mapping from booking status to badge variant.
  const { t } = useI18n()

  switch (status) {
    case 'held':
      return (
        <Badge className="inline-flex items-center gap-1 border border-blue-500/30 bg-blue-500/20 text-blue-400">
          <Clock className="size-3" />
          {t('booking.status.held')}
        </Badge>
      )
    case 'pending_payment':
      return (
        <Badge className="inline-flex items-center gap-1 border border-blue-500/30 bg-blue-500/20 text-blue-400">
          <Clock className="size-3" />
          {t('booking.status.pendingPayment')}
        </Badge>
      )
    case 'confirmed':
      return (
        <Badge className="inline-flex items-center gap-1 border border-green-500/30 bg-green-500/20 text-green-400">
          <CheckCircle className="size-3" />
          {t('booking.status.confirmed')}
        </Badge>
      )
    case 'checked_in':
      return (
        <Badge className="inline-flex items-center gap-1 border border-blue-500/30 bg-blue-500/20 text-blue-400">
          <CheckCircle className="size-3" />
          {t('booking.status.checkedIn')}
        </Badge>
      )
    case 'checked_out':
      return (
        <Badge className="inline-flex items-center gap-1 border border-slate-500/30 bg-slate-500/20 text-slate-400">
          <CheckCircle className="size-3" />
          {t('booking.status.checkedOut')}
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge className="inline-flex items-center gap-1 border border-red-500/30 bg-red-500/20 text-red-400">
          <XCircle className="size-3" />
          {t('booking.status.cancelled')}
        </Badge>
      )
    case 'expired':
      return (
        <Badge className="inline-flex items-center gap-1 border border-slate-500/30 bg-slate-500/20 text-slate-400">
          <AlertCircle className="size-3" />
          {t('booking.status.expired')}
        </Badge>
      )
    default:
      return <Badge className="bg-slate-500/20 text-slate-400">{status}</Badge>
  }
}

export function BookingCard({
  booking,
  room,
  hotel,
  cancellingId,
  onCancel,
}: BookingCardProps) {
  // Render a single booking row with quick actions and pricing details.
  const { t, locale } = useI18n()
  const roomTypeLabels: Record<string, string> = {
    single: t('hotel.singleRoom'),
    double: t('hotel.doubleRoom'),
    budget: t('hotel.budgetRoom'),
    standard: t('hotel.standardRoom'),
    suite: t('hotel.suiteRoom'),
    deluxe: t('hotel.deluxeRoom'),
  }
  const roomTypeLabel = roomTypeLabels[room.type] ?? room.type

  return (
    <Card className="light-hover-surface rounded-2xl border-slate-800/50 bg-slate-900/50 transition-colors hover:border-slate-700">
      <CardContent className="p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {hotel.name}
                </h3>
                <div className="mt-1 flex items-center gap-1 text-sm text-slate-400">
                  <MapPin className="size-4" />
                  {hotel.address}, {hotel.city}
                </div>
              </div>
              <StatusBadge status={booking.status} />
            </div>

            <div className="mb-4 flex items-center gap-2 text-slate-300">
              <BedDouble className="size-4 text-violet-400" />
              <span>
                {roomTypeLabel} - {t('hotel.room')} {room.roomNumber}
              </span>
            </div>

            <div className="mb-4">
              <Badge className="inline-flex items-center gap-2 border-slate-700 bg-slate-800 text-slate-300">
                {t('booking.package')}:{' '}
                {getPackageLabelOrDefault(booking.packageType, t)}
                {booking.packageType && (
                  <span className="text-slate-400">
                    ({formatPackageAddOn(booking.packageAddOn ?? 0, t)})
                  </span>
                )}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <span className="block text-slate-500">
                  {t('booking.checkIn')}
                </span>
                <span className="font-medium text-slate-200">
                  {formatDate(booking.checkIn, locale)}
                </span>
              </div>
              <div>
                <span className="block text-slate-500">
                  {t('booking.checkOut')}
                </span>
                <span className="font-medium text-slate-200">
                  {formatDate(booking.checkOut, locale)}
                </span>
              </div>
              <div>
                <span className="block text-slate-500">
                  {t('booking.priceNight')}
                </span>
                <span className="font-medium text-slate-200">
                  {formatPrice(booking.pricePerNight)}
                </span>
              </div>
              <div>
                <span className="block text-slate-500">
                  {t('booking.total')}
                </span>
                <span className="font-semibold text-violet-400">
                  {formatPrice(booking.totalPrice)}
                </span>
              </div>
            </div>

            {booking.status === 'held' && booking.holdExpiresAt && (
              <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <div className="flex items-center gap-2 text-sm text-blue-400">
                  <Clock className="size-4" />
                  <span>
                    {t('booking.holdExpires', {
                      time: formatTime(booking.holdExpiresAt, locale),
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {canCancel(booking.status) && (
          <div className="mt-4 flex gap-3 border-t border-slate-800 pt-4">
            {booking.status === 'held' && (
              <Button
                asChild
                className="bg-white text-slate-900 hover:bg-slate-100"
              >
                <Link
                  to="/hotels/$hotelId"
                  params={{ hotelId: hotel._id }}
                  search={{ resumeBookingId: booking._id }}
                >
                  {t('booking.confirmBooking')}
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onCancel(booking._id)}
              disabled={cancellingId === booking._id}
              className="border-slate-700 bg-slate-800 text-red-400 hover:bg-red-500/20 hover:text-red-300"
            >
              {cancellingId === booking._id ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('booking.cancelling')}
                </>
              ) : (
                <>
                  <X className="size-4" />
                  {t('booking.cancel')}
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
