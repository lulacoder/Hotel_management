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

// These are the staff-facing actions shown by the web admin UI. Automated
// payment and expiry transitions are governed separately below.
export const MANUAL_BOOKING_TRANSITIONS = {
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

export const BOOKING_TRANSITION_EVENTS = [
  'payment_proof_submitted',
  'booking_cancelled',
  'paid_booking_cancelled',
  'staff_status_updated',
  'cash_payment_accepted',
  'bank_payment_verified',
  'bank_payment_rejected',
  'booking_outsourced',
  'chapa_payment_confirmed',
  'hold_expired',
] as const

export type BookingTransitionEvent = (typeof BOOKING_TRANSITION_EVENTS)[number]

type BookingTransitionPair = readonly [BookingStatus, BookingStatus]

// Event-scoped rules prevent a general staff status mutation from invoking
// payment-provider or cron-only transitions that share the same status pair.
export const BOOKING_TRANSITION_RULES = {
  payment_proof_submitted: [['held', 'pending_payment']],
  booking_cancelled: [
    ['held', 'cancelled'],
    ['pending_payment', 'cancelled'],
    ['confirmed', 'cancelled'],
  ],
  paid_booking_cancelled: [['confirmed', 'cancelled']],
  staff_status_updated: [
    ['confirmed', 'checked_in'],
    ['checked_in', 'checked_out'],
  ],
  cash_payment_accepted: [
    ['held', 'confirmed'],
    ['pending_payment', 'confirmed'],
    ['confirmed', 'confirmed'],
    ['checked_in', 'checked_in'],
    ['checked_out', 'checked_out'],
  ],
  bank_payment_verified: [['pending_payment', 'confirmed']],
  bank_payment_rejected: [['pending_payment', 'cancelled']],
  booking_outsourced: [
    ['confirmed', 'outsourced'],
    ['checked_in', 'outsourced'],
  ],
  chapa_payment_confirmed: [
    ['held', 'confirmed'],
    ['confirmed', 'confirmed'],
  ],
  hold_expired: [
    ['held', 'expired'],
    ['pending_payment', 'expired'],
  ],
} as const satisfies Record<
  BookingTransitionEvent,
  ReadonlyArray<BookingTransitionPair>
>

const BOOKING_STATUS_SET = new Set<string>(BOOKING_STATUSES)
const TERMINAL_BOOKING_STATUS_SET = new Set<string>(TERMINAL_BOOKING_STATUSES)

// Checks whether a value is a recognized booking status
export function isBookingStatus(status: string): status is BookingStatus {
  return BOOKING_STATUS_SET.has(status)
}

// Checks whether a booking status blocks every further transition
export function isTerminalBookingStatus(
  status: string,
): status is TerminalBookingStatus {
  return TERMINAL_BOOKING_STATUS_SET.has(status)
}

// Returns the status choices shown in the staff booking interface
export function getAllowedBookingTransitions(
  status: string,
): ReadonlyArray<ManualBookingTransitionStatus> {
  if (!isBookingStatus(status)) {
    return []
  }

  return MANUAL_BOOKING_TRANSITIONS[status]
}

// Checks whether a product event owns the requested status change
export function canApplyBookingTransition(
  event: BookingTransitionEvent,
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return (
    BOOKING_TRANSITION_RULES[event] as ReadonlyArray<BookingTransitionPair>
  ).some(([allowedFrom, allowedTo]) => allowedFrom === from && allowedTo === to)
}

// Checks whether a customer may cancel without creating a refund obligation
export function canCustomerCancelBooking(
  status: string,
  paymentStatus?: string,
): boolean {
  return (
    paymentStatus !== 'paid' &&
    isBookingStatus(status) &&
    canApplyBookingTransition('booking_cancelled', status, 'cancelled')
  )
}

// Checks whether a booking ended through cancellation or hold expiry
export function isCancelledOrExpiredBookingStatus(status: string): boolean {
  return status === 'cancelled' || status === 'expired'
}
