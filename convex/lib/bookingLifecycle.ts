export const BOOKING_STATUSES = [
  'held',
  'pending_payment',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'expired',
  'outsourced',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const TERMINAL_BOOKING_STATUSES = [
  'cancelled',
  'expired',
  'checked_out',
  'outsourced',
] as const

export type TerminalBookingStatus = (typeof TERMINAL_BOOKING_STATUSES)[number]

export const MANUAL_BOOKING_TRANSITION_STATUSES = [
  'checked_in',
  'checked_out',
  'cancelled',
] as const

export type ManualBookingTransitionStatus =
  (typeof MANUAL_BOOKING_TRANSITION_STATUSES)[number]

export const ALLOWED_BOOKING_TRANSITIONS = {
  held: ['cancelled'],
  pending_payment: [],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
  expired: [],
  outsourced: [],
} as const satisfies Record<
  BookingStatus,
  ReadonlyArray<ManualBookingTransitionStatus>
>

const BOOKING_STATUS_SET = new Set<string>(BOOKING_STATUSES)
const TERMINAL_BOOKING_STATUS_SET = new Set<string>(TERMINAL_BOOKING_STATUSES)

export function isBookingStatus(status: string): status is BookingStatus {
  return BOOKING_STATUS_SET.has(status)
}

export function isTerminalBookingStatus(
  status: string,
): status is TerminalBookingStatus {
  return TERMINAL_BOOKING_STATUS_SET.has(status)
}

export function getAllowedBookingTransitions(
  status: string,
): ReadonlyArray<ManualBookingTransitionStatus> {
  if (!isBookingStatus(status)) {
    return []
  }

  return ALLOWED_BOOKING_TRANSITIONS[status]
}

export function canTransitionBooking(from: string, to: string): boolean {
  return (getAllowedBookingTransitions(from) as ReadonlyArray<string>).includes(
    to,
  )
}

export function getInvalidBookingTransitionMessage(
  from: string,
  to: string,
): string {
  return `Cannot transition booking from '${from}' to '${to}'.`
}

export function assertCanTransitionBooking(from: string, to: string): void {
  if (!canTransitionBooking(from, to)) {
    throw new Error(getInvalidBookingTransitionMessage(from, to))
  }
}

export function isCancelledOrExpiredBookingStatus(status: string): boolean {
  return status === 'cancelled' || status === 'expired'
}

export function isCompletedBookingStatus(status: string): boolean {
  return status === 'checked_out' || status === 'outsourced'
}

export function canAcceptBookingPayment(status: string): boolean {
  return !['cancelled', 'expired', 'outsourced'].includes(status)
}

export function canVerifySubmittedPayment(status: string): boolean {
  return status === 'pending_payment'
}

export function canUseHeldBooking(status: string): boolean {
  return status === 'held'
}

export function canOutsourceBooking(status: string): boolean {
  return status === 'confirmed' || status === 'checked_in'
}
