import { useMemo } from 'react'
import {
  Ban,
  CheckCircle,
  Clock,
  Hotel,
  LogIn,
  LogOut,
  XCircle,
} from 'lucide-react'

import { useI18n } from './i18n/provider'
import type {
  BookingStatus,
  ManualBookingTransitionStatus,
} from '../../convex/lib/bookingLifecycle'
import type { LucideIcon } from 'lucide-react'

export interface BookingStatusDisplay {
  label: string
  icon: LucideIcon
  color: string
  bg: string
  border: string
}

export function useBookingStatusConfig(): {
  statusConfig: Record<BookingStatus, BookingStatusDisplay>
  transitionLabel: Record<ManualBookingTransitionStatus, string>
} {
  const { t } = useI18n()

  return useMemo(
    () => ({
      transitionLabel: {
        checked_in: t('booking.transition.checkIn'),
        checked_out: t('booking.transition.checkOut'),
        cancelled: t('booking.transition.cancel'),
      },
      statusConfig: {
        held: {
          label: t('booking.status.held'),
          icon: Clock,
          color: 'text-blue-400',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
        },
        pending_payment: {
          label: t('booking.status.pendingPayment'),
          icon: Clock,
          color: 'text-blue-400',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
        },
        confirmed: {
          label: t('booking.status.confirmed'),
          icon: CheckCircle,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20',
        },
        checked_in: {
          label: t('booking.status.checkedIn'),
          icon: LogIn,
          color: 'text-blue-400',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
        },
        checked_out: {
          label: t('booking.status.checkedOut'),
          icon: LogOut,
          color: 'text-slate-400',
          bg: 'bg-slate-500/10',
          border: 'border-slate-500/20',
        },
        cancelled: {
          label: t('booking.status.cancelled'),
          icon: XCircle,
          color: 'text-red-400',
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
        },
        expired: {
          label: t('booking.status.expired'),
          icon: Ban,
          color: 'text-slate-500',
          bg: 'bg-slate-600/10',
          border: 'border-slate-600/20',
        },
        outsourced: {
          label: t('booking.status.outsourced'),
          icon: Hotel,
          color: 'text-purple-400',
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/20',
        },
      },
    }),
    [t],
  )
}
