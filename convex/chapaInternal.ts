import { v } from 'convex/values'

import { internalMutation, internalQuery } from './_generated/server'

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
  createdAt: v.number(),
  updatedAt: v.number(),
})

function shouldApplyStatus(
  currentStatus: ChapaPaymentStatus,
  nextStatus: ChapaPaymentStatus,
) {
  if (currentStatus === nextStatus) {
    return true
  }

  if (currentStatus === 'refunded' || currentStatus === 'reversed') {
    return false
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

    await ctx.db.patch(payment._id, patch)

    return await ctx.db.get(payment._id)
  },
})
