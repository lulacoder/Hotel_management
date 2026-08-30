import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation, internalQuery } from './_generated/server'
import { requireHotelManagement, requireUser } from './lib/auth'
import { isHoldExpiredAt } from './lib/dates'
import { transitionRefund } from './lib/refunds'

const CHECKOUT_ATTEMPT_STALE_AFTER_MS = 90_000

const chapaPaymentStatusValidator = v.union(
  v.literal('initialized'),
  v.literal('paid'),
  v.literal('failed'),
  v.literal('cancelled'),
  v.literal('refund_required'),
  v.literal('refund_initiated'),
  v.literal('refunded'),
  v.literal('reversed'),
)

const providerModeValidator = v.union(v.literal('test'), v.literal('live'))
const checkoutOriginValidator = v.union(v.literal('web'), v.literal('mobile'))

const reservedCheckoutValidator = v.object({
  state: v.literal('reserved'),
  txRef: v.string(),
  bookingAmountCents: v.number(),
  chargedAmountMinor: v.number(),
  fxRateEtbPerUsd: v.number(),
  providerMode: providerModeValidator,
  origin: checkoutOriginValidator,
  guestName: v.optional(v.string()),
  email: v.string(),
  checkIn: v.string(),
  checkOut: v.string(),
})

const initializingCheckoutValidator = v.object({
  state: v.literal('initializing'),
  txRef: v.string(),
})

const initializedCheckoutValidator = v.object({
  state: v.literal('initialized'),
  txRef: v.string(),
  checkoutUrl: v.string(),
})

const invalidEmailValidator = v.object({
  state: v.literal('invalid_email'),
})

type ChapaPaymentStatus =
  | 'initialized'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refund_required'
  | 'refund_initiated'
  | 'refunded'
  | 'reversed'

export const chapaPaymentValidator = v.object({
  _id: v.id('chapaPayments'),
  _creationTime: v.number(),
  bookingId: v.id('bookings'),
  txRef: v.string(),
  chapaReference: v.optional(v.string()),
  bookingAmountCents: v.number(),
  bookingCurrency: v.literal('USD'),
  chargedAmountMinor: v.number(),
  chargedCurrency: v.literal('ETB'),
  fxRateEtbPerUsd: v.number(),
  status: chapaPaymentStatusValidator,
  checkoutUrl: v.string(),
  providerMode: v.optional(providerModeValidator),
  paymentMethod: v.optional(v.string()),
  lastEvent: v.optional(v.string()),
  lastStatus: v.optional(v.string()),
  lastError: v.optional(v.string()),
  lastPayload: v.optional(v.any()),
  callbackReceivedAt: v.optional(v.number()),
  webhookReceivedAt: v.optional(v.number()),
  verifiedAt: v.optional(v.number()),
  refundedAt: v.optional(v.number()),
  refundReference: v.optional(v.string()),
  refundRefId: v.optional(v.string()),
  refundAmountMinor: v.optional(v.number()),
  refundRequestedBy: v.optional(v.id('users')),
  refundRequestedAt: v.optional(v.number()),
  refundVerifiedAt: v.optional(v.number()),
  refundLastError: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

// Allows payment states to advance without regressing terminal outcomes
function shouldApplyStatus(
  currentStatus: ChapaPaymentStatus,
  nextStatus: ChapaPaymentStatus,
) {
  if (currentStatus === nextStatus) {
    return true
  }

  if (currentStatus === 'refunded') {
    return false
  }

  if (currentStatus === 'reversed') {
    return nextStatus === 'refund_initiated' || nextStatus === 'refunded'
  }

  if (currentStatus === 'paid') {
    return (
      nextStatus === 'refund_required' ||
      nextStatus === 'refund_initiated' ||
      nextStatus === 'refunded' ||
      nextStatus === 'reversed'
    )
  }

  if (currentStatus === 'refund_required') {
    return (
      nextStatus === 'refund_initiated' ||
      nextStatus === 'refunded' ||
      nextStatus === 'reversed'
    )
  }

  return true
}

// Reserves one active checkout so only one action may contact Chapa
export const reserveHostedCheckout = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    txRef: v.string(),
    fxRateEtbPerUsd: v.number(),
    providerMode: providerModeValidator,
    origin: checkoutOriginValidator,
  },
  returns: v.union(
    reservedCheckoutValidator,
    initializingCheckoutValidator,
    initializedCheckoutValidator,
    invalidEmailValidator,
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const booking = await ctx.db.get(args.bookingId)
    const now = Date.now()

    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    if (booking.userId !== user._id) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You can only pay for your own booking.',
      })
    }

    if (booking.status !== 'held') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Only held bookings can be paid with Chapa.',
      })
    }

    if (isHoldExpiredAt(booking.holdExpiresAt, now)) {
      throw new ConvexError({
        code: 'EXPIRED',
        message: 'Your booking hold has expired.',
      })
    }

    const activeAttempt = await ctx.db
      .query('chapaCheckoutAttempts')
      .withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId))
      .order('desc')
      .filter((q) =>
        q.or(
          q.eq(q.field('status'), 'initializing'),
          q.eq(q.field('status'), 'initialized'),
        ),
      )
      .first()

    if (activeAttempt?.status === 'initializing') {
      const isStale =
        activeAttempt.updatedAt <= now - CHECKOUT_ATTEMPT_STALE_AFTER_MS

      if (!isStale) {
        return {
          state: 'initializing' as const,
          txRef: activeAttempt.txRef,
        }
      }

      // Reclaim an attempt whose action disappeared before finalization
      await ctx.db.patch(activeAttempt._id, {
        status: 'failed',
        lastError: 'Checkout initialization timed out before finalization.',
        updatedAt: now,
      })
    }

    if (activeAttempt?.status === 'initialized') {
      if (!activeAttempt.checkoutUrl) {
        throw new ConvexError({
          code: 'INVALID_STATE',
          message: 'Initialized checkout is missing its provider URL.',
        })
      }

      return {
        state: 'initialized' as const,
        txRef: activeAttempt.txRef,
        checkoutUrl: activeAttempt.checkoutUrl,
      }
    }

    // Preserve initialized payments created before checkout reservations existed.
    const existingPayment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId))
      .order('desc')
      .filter((q) => q.eq(q.field('status'), 'initialized'))
      .first()

    if (existingPayment) {
      return {
        state: 'initialized' as const,
        txRef: existingPayment.txRef,
        checkoutUrl: existingPayment.checkoutUrl,
      }
    }

    const email = booking.guestEmail || user.email
    if (!email) {
      return { state: 'invalid_email' as const }
    }

    const chargedAmountMinor = Math.round(
      booking.totalPrice * args.fxRateEtbPerUsd,
    )

    // Snapshot the quoted price before the action contacts Chapa
    await ctx.db.insert('chapaCheckoutAttempts', {
      bookingId: args.bookingId,
      txRef: args.txRef,
      bookingAmountCents: booking.totalPrice,
      bookingCurrency: 'USD',
      chargedAmountMinor,
      chargedCurrency: 'ETB',
      fxRateEtbPerUsd: args.fxRateEtbPerUsd,
      providerMode: args.providerMode,
      origin: args.origin,
      status: 'initializing',
      createdAt: now,
      updatedAt: now,
    })

    return {
      state: 'reserved' as const,
      txRef: args.txRef,
      bookingAmountCents: booking.totalPrice,
      chargedAmountMinor,
      fxRateEtbPerUsd: args.fxRateEtbPerUsd,
      providerMode: args.providerMode,
      origin: args.origin,
      guestName: booking.guestName,
      email,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
    }
  },
})

// Finalizes a reservation and creates its payment record atomically
export const finalizeHostedCheckout = internalMutation({
  args: {
    txRef: v.string(),
    checkoutUrl: v.string(),
  },
  returns: v.object({
    txRef: v.string(),
    checkoutUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const attempt = await ctx.db
      .query('chapaCheckoutAttempts')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()

    if (!attempt) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Checkout reservation not found.',
      })
    }

    if (attempt.status === 'failed') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'A failed checkout reservation cannot be finalized.',
      })
    }

    if (attempt.status === 'initialized') {
      return {
        txRef: attempt.txRef,
        checkoutUrl: attempt.checkoutUrl ?? args.checkoutUrl,
      }
    }

    const now = Date.now()
    // Mark the winning reservation initialized with Chapa's hosted URL
    await ctx.db.patch(attempt._id, {
      status: 'initialized',
      checkoutUrl: args.checkoutUrl,
      updatedAt: now,
    })
    // Create the canonical payment from the immutable reservation snapshot
    await ctx.db.insert('chapaPayments', {
      bookingId: attempt.bookingId,
      txRef: attempt.txRef,
      bookingAmountCents: attempt.bookingAmountCents,
      bookingCurrency: attempt.bookingCurrency,
      chargedAmountMinor: attempt.chargedAmountMinor,
      chargedCurrency: attempt.chargedCurrency,
      fxRateEtbPerUsd: attempt.fxRateEtbPerUsd,
      status: 'initialized',
      checkoutUrl: args.checkoutUrl,
      providerMode: attempt.providerMode,
      createdAt: now,
      updatedAt: now,
    })

    return {
      txRef: attempt.txRef,
      checkoutUrl: args.checkoutUrl,
    }
  },
})

// Marks a provider-rejected reservation as failed so the customer can retry
export const failHostedCheckout = internalMutation({
  args: {
    txRef: v.string(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db
      .query('chapaCheckoutAttempts')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()

    if (attempt?.status === 'initializing') {
      // Close a rejected attempt so a later checkout may reserve a new one
      await ctx.db.patch(attempt._id, {
        status: 'failed',
        lastError: args.error,
        updatedAt: Date.now(),
      })
    }

    return null
  },
})

// Creates a canonical record for an initialized Chapa payment
export const createPaymentRecord = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    txRef: v.string(),
    bookingAmountCents: v.number(),
    chargedAmountMinor: v.number(),
    fxRateEtbPerUsd: v.number(),
    checkoutUrl: v.string(),
    providerMode: providerModeValidator,
  },
  returns: v.id('chapaPayments'),
  handler: async (ctx, args) => {
    const now = Date.now()

    // Store the provider transaction with its quoted amount and FX rate
    return await ctx.db.insert('chapaPayments', {
      bookingId: args.bookingId,
      txRef: args.txRef,
      bookingAmountCents: args.bookingAmountCents,
      bookingCurrency: 'USD',
      chargedAmountMinor: args.chargedAmountMinor,
      chargedCurrency: 'ETB',
      fxRateEtbPerUsd: args.fxRateEtbPerUsd,
      status: 'initialized',
      checkoutUrl: args.checkoutUrl,
      providerMode: args.providerMode,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Finds a Chapa payment by its provider transaction reference
export const getByTxRef = internalQuery({
  args: {
    txRef: v.string(),
  },
  returns: v.union(chapaPaymentValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('chapaPayments')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()
  },
})

// Finds the most recent Chapa payment attempt for a booking
export const getLatestByBooking = internalQuery({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.union(chapaPaymentValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('chapaPayments')
      .withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId))
      .order('desc')
      .first()
  },
})

// Applies a verified provider update without regressing payment status
export const updatePaymentRecord = internalMutation({
  args: {
    txRef: v.string(),
    status: v.optional(chapaPaymentStatusValidator),
    chapaReference: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    providerMode: v.optional(providerModeValidator),
    event: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    payload: v.optional(v.any()),
    source: v.union(
      v.literal('webhook'),
      v.literal('callback'),
      v.literal('system'),
    ),
    lastError: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    refundedAt: v.optional(v.number()),
  },
  returns: v.union(chapaPaymentValidator, v.null()),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()

    if (!payment) {
      return null
    }

    const now = Date.now()
    const patch: Partial<typeof payment> = {
      updatedAt: now,
    }

    if (args.source === 'webhook') {
      patch.webhookReceivedAt = now
    }

    if (args.source === 'callback') {
      patch.callbackReceivedAt = now
    }

    if (args.status && shouldApplyStatus(payment.status, args.status)) {
      patch.status = args.status
    }

    if (args.chapaReference !== undefined) {
      patch.chapaReference = args.chapaReference
    }

    if (args.paymentMethod !== undefined) {
      patch.paymentMethod = args.paymentMethod
    }

    if (args.providerMode !== undefined) {
      patch.providerMode = args.providerMode
    }

    if (args.event !== undefined) {
      patch.lastEvent = args.event
    }

    if (args.providerStatus !== undefined) {
      patch.lastStatus = args.providerStatus
    }

    if (args.payload !== undefined) {
      patch.lastPayload = args.payload
    }

    if (args.lastError !== undefined) {
      patch.lastError = args.lastError
    }

    if (args.verifiedAt !== undefined) {
      patch.verifiedAt = args.verifiedAt
    }

    if (args.refundedAt !== undefined) {
      patch.refundedAt = args.refundedAt
    }

    // Persist only fields verified by the reconciliation action
    await ctx.db.patch(payment._id, patch)

    return await ctx.db.get(payment._id)
  },
})

const refundReservationValidator = v.union(
  v.object({
    state: v.literal('reserved'),
    bookingId: v.id('bookings'),
    txRef: v.string(),
    chapaReference: v.string(),
    refundReference: v.string(),
    amountMinor: v.number(),
  }),
  v.object({ state: v.literal('processing') }),
  v.object({ state: v.literal('verification_required') }),
  v.object({ state: v.literal('refunded') }),
)

// Atomically reserves the one Chapa refund request allowed for a booking
export const reserveRefund = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    refundReference: v.string(),
  },
  returns: refundReservationValidator,
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    const { user } = await requireHotelManagement(ctx, booking.hotelId)

    if (booking.refundStatus === 'refunded') {
      return { state: 'refunded' as const }
    }

    if (booking.refundStatus === 'processing') {
      return { state: 'processing' as const }
    }

    if (booking.refundStatus === 'verification_required') {
      return { state: 'verification_required' as const }
    }

    if (
      booking.refundMethod !== 'chapa' ||
      !['required', 'reversed'].includes(booking.refundStatus ?? '')
    ) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'This booking does not have a refundable Chapa payment.',
      })
    }

    const payment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_booking', (q) => q.eq('bookingId', booking._id))
      .order('desc')
      .filter((q) =>
        q.or(
          q.eq(q.field('status'), 'refund_required'),
          q.eq(q.field('status'), 'reversed'),
        ),
      )
      .first()

    if (!payment) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'The paid Chapa transaction could not be found.',
      })
    }

    // Chapa addresses a refund by the reference it issued at payment time, so
    // without it no API refund can be targeted and staff must pay out by hand
    if (!payment.chapaReference) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message:
          'This payment has no Chapa reference, so it cannot be refunded through the API. Refund it manually and record the reference.',
      })
    }

    const now = Date.now()
    // Lock the canonical payment before any action contacts Chapa
    await ctx.db.patch(payment._id, {
      status: 'refund_initiated',
      refundReference: args.refundReference,
      refundAmountMinor: payment.chargedAmountMinor,
      refundRequestedBy: user._id,
      refundRequestedAt: now,
      refundLastError: undefined,
      updatedAt: now,
    })

    // Expose the in-flight state to staff in the same transaction, while the
    // guest stays silent until the refund actually settles
    await transitionRefund(ctx, {
      booking,
      to: 'processing',
      actor: { kind: 'user', userId: user._id },
      metadata: {
        txRef: payment.txRef,
        refundReference: args.refundReference,
        amountMinor: payment.chargedAmountMinor,
        currency: payment.chargedCurrency,
      },
      now,
    })

    return {
      state: 'reserved' as const,
      bookingId: booking._id,
      txRef: payment.txRef,
      chapaReference: payment.chapaReference,
      refundReference: args.refundReference,
      amountMinor: payment.chargedAmountMinor,
    }
  },
})

// Persists Chapa's refund identifier immediately after an accepted request
export const recordRefundAcceptance = internalMutation({
  args: {
    txRef: v.string(),
    refundReference: v.string(),
    refundRefId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()

    if (
      payment?.status === 'refund_initiated' &&
      payment.refundReference === args.refundReference
    ) {
      // Store the only handle that can verify this refund later
      await ctx.db.patch(payment._id, {
        refundRefId: args.refundRefId,
        refundLastError: undefined,
        updatedAt: Date.now(),
      })

      // Tell the hotel's administrators Chapa took the money, queued here so a
      // rejected or ambiguous attempt never triggers the mail
      await ctx.scheduler.runAfter(
        0,
        internal.refundEmails.sendRefundAcceptedEmails,
        {
          bookingId: payment.bookingId,
          refundRefId: args.refundRefId,
          refundAmountMinor:
            payment.refundAmountMinor ?? payment.chargedAmountMinor,
          requestedBy: payment.refundRequestedBy,
        },
      )
    }

    return null
  },
})

// Reopens a refund only after Chapa definitively rejects the request
export const rejectRefund = internalMutation({
  args: {
    txRef: v.string(),
    refundReference: v.string(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()

    if (
      !payment ||
      payment.status !== 'refund_initiated' ||
      payment.refundReference !== args.refundReference
    ) {
      return null
    }

    const now = Date.now()
    // A proven rejection is safe to make retryable with a new staff click
    await ctx.db.patch(payment._id, {
      status: 'refund_required',
      refundLastError: args.error,
      lastError: args.error,
      updatedAt: now,
    })

    const booking = await ctx.db.get(payment.bookingId)
    // Only a still-processing refund may reopen, so a provider result arriving
    // out of order can never drag a settled refund backwards
    if (booking?.refundStatus === 'processing') {
      // Route the outcome through the booking projection so every path that
      // resolves a refund alerts staff and the guest the same way
      await ctx.runMutation(internal.bookings.applyChapaRefundOutcome, {
        bookingId: payment.bookingId,
        outcome: 'required',
        txRef: payment.txRef,
        refundReference: args.refundReference,
        error: args.error,
      })
    }

    return null
  },
})

// Blocks retries when Chapa may have accepted a request without returning an ID
export const markRefundVerificationRequired = internalMutation({
  args: {
    txRef: v.string(),
    refundReference: v.string(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()

    if (
      !payment ||
      payment.status !== 'refund_initiated' ||
      payment.refundReference !== args.refundReference
    ) {
      return null
    }

    // Preserve the in-flight payment lock because another POST could double-refund
    await ctx.db.patch(payment._id, {
      refundLastError: args.error,
      lastError: args.error,
      updatedAt: Date.now(),
    })

    const booking = await ctx.db.get(payment.bookingId)
    // Only a still-processing refund may become uncertain, so a settled refund
    // is never pushed back into a state that blocks staff
    if (booking?.refundStatus === 'processing') {
      // Alert every assigned staff member because this state means money may
      // have moved without a usable verification handle
      await ctx.runMutation(internal.bookings.applyChapaRefundOutcome, {
        bookingId: payment.bookingId,
        outcome: 'verification_required',
        txRef: payment.txRef,
        refundReference: args.refundReference,
        error: args.error,
      })
    }

    return null
  },
})

// Returns a bounded batch of accepted refunds that still need provider polling
export const listRefundsToVerify = internalQuery({
  args: {},
  returns: v.array(chapaPaymentValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query('chapaPayments')
      .withIndex('by_status', (q) => q.eq('status', 'refund_initiated'))
      .filter((q) => q.neq(q.field('refundRefId'), undefined))
      .take(50)
  },
})

// Applies one verified refund status to both the payment and booking records
// Repairs bookings left mid-refund whose Chapa payment row already settled.
// Called by the refund verification cron, this covers a settled provider result
// that reached the payment row but never reached its booking projection.
export const settleDriftedRefunds = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const inFlight = await ctx.db
      .query('bookings')
      .withIndex('by_refund_status', (q) => q.eq('refundStatus', 'processing'))
      .take(50)

    let repairedCount = 0

    for (const booking of inFlight) {
      const attempts = await ctx.db
        .query('chapaPayments')
        .withIndex('by_booking', (q) => q.eq('bookingId', booking._id))
        .collect()

      const settled = attempts.find(
        (attempt) =>
          attempt.status === 'refunded' || attempt.status === 'reversed',
      )

      if (!settled) {
        continue
      }

      // Replay the outcome the payment row already proved so the guest hears it
      await ctx.runMutation(internal.bookings.applyChapaRefundOutcome, {
        bookingId: booking._id,
        outcome: settled.status === 'refunded' ? 'refunded' : 'reversed',
        txRef: settled.txRef,
        refundReference: settled.refundReference,
        refundRefId: settled.refundRefId,
        error:
          settled.status === 'reversed'
            ? 'Chapa reversed the refund before it completed.'
            : undefined,
      })

      repairedCount += 1
    }

    return repairedCount
  },
})

export const applyVerifiedRefund = internalMutation({
  args: {
    txRef: v.string(),
    refundRefId: v.string(),
    status: v.union(
      v.literal('processing'),
      v.literal('refunded'),
      v.literal('reversed'),
    ),
    payload: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()

    if (!payment || payment.refundRefId !== args.refundRefId) {
      return null
    }

    const now = Date.now()
    const paymentStatus =
      args.status === 'processing' ? 'refund_initiated' : args.status
    // Persist the provider result before synchronizing its booking projection
    await ctx.db.patch(payment._id, {
      status: paymentStatus,
      refundVerifiedAt: now,
      refundedAt: args.status === 'refunded' ? now : payment.refundedAt,
      refundLastError:
        args.status === 'reversed'
          ? 'Chapa reversed the refund before it completed.'
          : undefined,
      lastPayload: args.payload,
      updatedAt: now,
    })

    if (args.status !== 'processing') {
      // Share the webhook's projection so a refund confirmed by the polling
      // cron notifies the guest and staff exactly like a delivered webhook
      await ctx.runMutation(internal.bookings.applyChapaRefundOutcome, {
        bookingId: payment.bookingId,
        outcome: args.status,
        txRef: payment.txRef,
        refundReference: payment.refundReference,
        refundRefId: payment.refundRefId,
        error:
          args.status === 'reversed'
            ? 'Chapa reversed the refund before it completed.'
            : undefined,
      })
    }

    return null
  },
})
