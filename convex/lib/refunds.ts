import { ConvexError } from 'convex/values'

import { createAuditLog } from '../audit'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export type RefundStatus =
  | 'required'
  | 'processing'
  | 'refunded'
  | 'reversed'
  | 'verification_required'

export type RefundMethod = 'chapa' | 'manual'
export type RefundReason = 'late_payment' | 'staff_cancelled' | 'no_show'

export type RefundActor =
  | { kind: 'user'; userId: Id<'users'> }
  | { kind: 'system'; reason: string }
  | { kind: 'provider'; provider: 'chapa' }

interface TransitionRefundParams {
  booking: Doc<'bookings'>
  to: RefundStatus
  actor: RefundActor
  method?: RefundMethod
  reason?: RefundReason
  error?: string
  manualReference?: string
  metadata?: Record<string, unknown>
  now?: number
}

const ALLOWED_REFUND_TRANSITIONS: Record<
  RefundStatus | 'none',
  ReadonlyArray<RefundStatus>
> = {
  none: ['required', 'refunded', 'reversed'],
  required: ['processing', 'refunded', 'reversed'],
  processing: ['required', 'refunded', 'reversed', 'verification_required'],
  refunded: [],
  reversed: ['processing', 'refunded'],
  verification_required: ['refunded', 'reversed'],
}

// Converts absent audit values to null so cleared fields remain visible
function toAuditValue(value: unknown): unknown {
  return value === undefined ? null : value
}

// Describes a non-user refund actor without inventing an updatedBy value
function getActorMetadata(actor: RefundActor): Record<string, unknown> {
  if (actor.kind === 'system') {
    return { actorKind: 'system', reason: actor.reason }
  }

  if (actor.kind === 'provider') {
    return { actorKind: 'provider', provider: actor.provider }
  }

  return { actorKind: 'user' }
}

// Maps each refund state to whether hotel staff must still take action
export function refundNeedsStaffAction(status: RefundStatus): boolean {
  return ['required', 'reversed', 'verification_required'].includes(status)
}

// Applies one guarded refund state change and its audit record atomically
export async function transitionRefund(
  ctx: MutationCtx,
  params: TransitionRefundParams,
): Promise<void> {
  const current = params.booking.refundStatus ?? 'none'
  const now = params.now ?? Date.now()

  if (current === params.to) {
    return
  }

  if (!ALLOWED_REFUND_TRANSITIONS[current].includes(params.to)) {
    throw new ConvexError({
      code: 'INVALID_STATE',
      message: `Refund cannot move from ${current} to ${params.to}.`,
    })
  }

  const method = params.method ?? params.booking.refundMethod
  if (!method) {
    throw new ConvexError({
      code: 'INVALID_STATE',
      message: 'A refund method must be recorded before refund work begins.',
    })
  }

  const patch = {
    refundStatus: params.to,
    refundMethod: method,
    refundActionRequired: refundNeedsStaffAction(params.to),
    ...(params.reason ? { refundReason: params.reason } : {}),
    ...(params.to === 'required' && !params.booking.refundRequiredAt
      ? { refundRequiredAt: now }
      : {}),
    ...(params.to === 'processing' ? { refundStartedAt: now } : {}),
    // Clear any error from an earlier attempt so a completed refund does not keep
    // showing staff a failure that no longer applies
    ...(params.to === 'refunded'
      ? {
          paymentStatus: 'refunded' as const,
          refundCompletedAt: now,
          refundLastError: undefined,
        }
      : {}),
    ...(params.error !== undefined ? { refundLastError: params.error } : {}),
    ...(params.manualReference
      ? { manualRefundReference: params.manualReference }
      : {}),
    updatedAt: now,
    ...(params.actor.kind === 'user' ? { updatedBy: params.actor.userId } : {}),
  }

  // Persist the refund projection used by staff and customer booking views
  await ctx.db.patch(params.booking._id, patch)

  const previousValue: Record<string, unknown> = {
    refundStatus: toAuditValue(params.booking.refundStatus),
    paymentStatus: toAuditValue(params.booking.paymentStatus),
  }
  const newValue: Record<string, unknown> = {
    refundStatus: params.to,
    paymentStatus:
      params.to === 'refunded'
        ? 'refunded'
        : toAuditValue(params.booking.paymentStatus),
  }

  // Record every provider, system, or staff refund decision for disputes
  await createAuditLog(ctx, {
    actorId: params.actor.kind === 'user' ? params.actor.userId : undefined,
    action: `booking_refund_${params.to}`,
    targetType: 'booking',
    targetId: params.booking._id,
    previousValue,
    newValue,
    metadata: {
      method,
      reason: params.reason ?? params.booking.refundReason,
      error: params.error,
      ...params.metadata,
      ...getActorMetadata(params.actor),
    },
  })
}
