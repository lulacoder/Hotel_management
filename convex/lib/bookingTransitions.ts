import { ConvexError } from 'convex/values'

import { createAuditLog } from '../audit'
import { canApplyBookingTransition } from './bookingLifecycle'
import { hasProofReviewLapsed, isHoldExpiredAt } from './dates'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { BookingStatus, BookingTransitionEvent } from './bookingLifecycle'

export type BookingTransitionActor =
  | { kind: 'user'; userId: Id<'users'> }
  | { kind: 'system'; reason: string }
  | { kind: 'provider'; provider: 'chapa' }

export type BookingTransitionChanges = Partial<
  Pick<
    Doc<'bookings'>,
    | 'paymentStatus'
    | 'paymentMethod'
    | 'holdExpiresAt'
    | 'proofReviewDeadline'
    | 'transactionId'
    | 'nationalIdStorageId'
    | 'nationalIdR2Key'
    | 'outsourcedToHotelId'
    | 'outsourcedAt'
    | 'refundStatus'
    | 'refundMethod'
    | 'refundReason'
    | 'refundActionRequired'
    | 'refundRequiredAt'
    | 'refundStartedAt'
    | 'refundCompletedAt'
    | 'refundLastError'
    | 'manualRefundReference'
  >
>

const AUDIT_ACTIONS = {
  payment_proof_submitted: 'booking_payment_proof_submitted',
  booking_cancelled: 'booking_cancelled',
  paid_booking_cancelled: 'booking_cancelled_refund_required',
  staff_status_updated: 'booking_status_updated',
  cash_payment_accepted: 'booking_payment_paid_cash',
  bank_payment_verified: 'booking_payment_verified',
  bank_payment_rejected: 'booking_payment_rejected',
  booking_outsourced: 'booking_outsourced',
  chapa_payment_confirmed: 'booking_payment_verified',
  hold_expired: 'booking_expired',
} as const satisfies Record<BookingTransitionEvent, string>

const INVALID_TRANSITION_MESSAGES = {
  payment_proof_submitted:
    'This booking is no longer awaiting a payment proof.',
  booking_cancelled: 'This booking can no longer be cancelled.',
  paid_booking_cancelled:
    'Only a confirmed paid booking can be cancelled for refund.',
  staff_status_updated: 'This booking status can no longer be updated.',
  cash_payment_accepted: 'Cash cannot be accepted for this booking status.',
  bank_payment_verified: 'This payment proof can no longer be approved.',
  bank_payment_rejected: 'This payment proof can no longer be rejected.',
  booking_outsourced: 'This booking can no longer be outsourced.',
  chapa_payment_confirmed:
    'This booking can no longer be confirmed from this payment.',
  hold_expired: 'This booking hold can no longer be expired.',
} as const satisfies Record<BookingTransitionEvent, string>

interface TransitionBookingParams {
  booking: Doc<'bookings'>
  event: BookingTransitionEvent
  to: BookingStatus
  actor: BookingTransitionActor
  changes?: BookingTransitionChanges
  metadata?: Record<string, unknown>
  now?: number
}

// Converts cleared fields to null so audit JSON records their removal
function toAuditValue(value: unknown): unknown {
  return value === undefined ? null : value
}

// Marks automated actors without attributing their work to a user
function getActorMetadata(
  actor: BookingTransitionActor,
): Record<string, unknown> {
  if (actor.kind === 'system') {
    return { actorKind: 'system', reason: actor.reason }
  }

  if (actor.kind === 'provider') {
    return { actorKind: 'provider', provider: actor.provider }
  }

  return { actorKind: 'user' }
}

// Enforces the payment and hold invariants owned by each lifecycle event
function assertProjectedTransition(
  booking: Doc<'bookings'>,
  event: BookingTransitionEvent,
  to: BookingStatus,
  changes: BookingTransitionChanges,
  now: number,
): void {
  if (!canApplyBookingTransition(event, booking.status, to)) {
    if (event === 'booking_cancelled' && booking.status === 'checked_in') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Cannot cancel a checked-in or completed booking.',
      })
    }

    throw new ConvexError({
      code: 'INVALID_STATE',
      reason:
        event === 'payment_proof_submitted'
          ? 'PAYMENT_PROOF_NOT_ALLOWED'
          : 'BOOKING_TRANSITION_NOT_ALLOWED',
      message: INVALID_TRANSITION_MESSAGES[event],
      transition: { event, from: booking.status, to },
    })
  }

  if (event === 'booking_cancelled' && booking.paymentStatus === 'paid') {
    throw new ConvexError({
      code: 'INVALID_STATE',
      reason: 'PAID_BOOKING_REQUIRES_STAFF_REFUND',
      message: 'Paid bookings must be cancelled by staff for refund review.',
    })
  }

  if (
    event === 'paid_booking_cancelled' &&
    (booking.paymentStatus !== 'paid' ||
      changes.refundStatus !== 'required' ||
      !changes.refundMethod ||
      !changes.refundReason ||
      changes.refundActionRequired !== true ||
      typeof changes.refundRequiredAt !== 'number')
  ) {
    throw new ConvexError({
      code: 'INVALID_STATE',
      reason: 'REFUND_MARKER_REQUIRED',
      message: 'Paid cancellation must create a refund-required marker.',
    })
  }

  if (
    booking.status === 'held' &&
    [
      'payment_proof_submitted',
      'cash_payment_accepted',
      'chapa_payment_confirmed',
    ].includes(event) &&
    isHoldExpiredAt(booking.holdExpiresAt, now)
  ) {
    throw new ConvexError({
      code: 'EXPIRED',
      message: 'Your booking hold has expired.',
    })
  }

  const clearsHold =
    'holdExpiresAt' in changes && changes.holdExpiresAt === undefined
  const clearsProofReview =
    'proofReviewDeadline' in changes &&
    changes.proofReviewDeadline === undefined

  if (
    event === 'payment_proof_submitted' &&
    (changes.paymentStatus !== 'pending' ||
      !clearsHold ||
      typeof changes.proofReviewDeadline !== 'number')
  ) {
    throw new ConvexError({
      code: 'INVALID_STATE',
      message:
        'Payment proof submission must clear the hold and open a review deadline.',
    })
  }

  // A booking that leaves review no longer owes staff an answer, and a stale
  // deadline would leave the expiry sweep holding a claim on a settled booking
  if (
    booking.status === 'pending_payment' &&
    to !== 'pending_payment' &&
    !clearsProofReview
  ) {
    throw new ConvexError({
      code: 'INVALID_STATE',
      message: 'Leaving payment review must clear its review deadline.',
    })
  }

  if (
    [
      'cash_payment_accepted',
      'bank_payment_verified',
      'chapa_payment_confirmed',
    ].includes(event) &&
    (changes.paymentStatus !== 'paid' || !clearsHold)
  ) {
    throw new ConvexError({
      code: 'INVALID_STATE',
      message:
        'A confirmed payment must mark the booking paid and clear its hold.',
    })
  }

  if (event === 'bank_payment_rejected' && changes.paymentStatus !== 'failed') {
    throw new ConvexError({
      code: 'INVALID_STATE',
      message: 'A rejected payment must be marked failed.',
    })
  }

  if (event === 'hold_expired') {
    // Each expirable status carries its own clock. A held booking waits on the
    // customer to pay, a pending-payment booking waits on staff to review.
    const deadlineHasPassed =
      booking.status === 'pending_payment'
        ? hasProofReviewLapsed(booking.proofReviewDeadline, now)
        : booking.holdExpiresAt !== undefined && booking.holdExpiresAt < now

    if (
      booking.paymentStatus === 'paid' ||
      booking.paymentStatus === 'refunded' ||
      !deadlineHasPassed
    ) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message:
          'Only an unpaid booking past its hold or payment review deadline can expire.',
      })
    }

    if (changes.paymentStatus !== 'failed') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'An expired hold must be marked failed.',
      })
    }
  }
}

// Applies a booking transition and its audit event in one transaction
export async function transitionBooking(
  ctx: MutationCtx,
  params: TransitionBookingParams,
): Promise<void> {
  const changes = params.changes ?? {}
  const now = params.now ?? Date.now()

  // Reject undeclared status changes and invalid projected payment states
  assertProjectedTransition(
    params.booking,
    params.event,
    params.to,
    changes,
    now,
  )

  const patch = {
    ...changes,
    status: params.to,
    updatedAt: now,
    ...(params.actor.kind === 'user' ? { updatedBy: params.actor.userId } : {}),
  }

  const previousValue: Record<string, unknown> = {
    status: params.booking.status,
  }
  const newValue: Record<string, unknown> = { status: params.to }

  // Capture every changed field in the before-and-after audit snapshot
  for (const [key, value] of Object.entries(changes)) {
    const previous = toAuditValue(params.booking[key as keyof Doc<'bookings'>])
    const next = toAuditValue(value)
    // Clearing a field the booking never carried patches nothing, so leave it
    // out rather than recording a change the booking did not make
    if (previous === null && next === null) continue

    previousValue[key] = previous
    newValue[key] = next
  }

  // Persist the validated booking state inside the caller's transaction
  await ctx.db.patch(params.booking._id, patch)
  // Record the same transition with its user, provider, or system actor
  await createAuditLog(ctx, {
    actorId: params.actor.kind === 'user' ? params.actor.userId : undefined,
    action: AUDIT_ACTIONS[params.event],
    targetType: 'booking',
    targetId: params.booking._id,
    previousValue,
    newValue,
    metadata: {
      ...params.metadata,
      ...getActorMetadata(params.actor),
    },
  })
}
