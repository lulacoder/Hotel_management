'use node'

import * as crypto from 'node:crypto'

import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

const CHAPA_API_BASE = 'https://api.chapa.co/v1'

type ReconcileSource = 'webhook' | 'callback'

interface ChapaInitializeResponse {
  message: unknown
  status: string
  data?: {
    checkout_url?: string
  }
}

interface ChapaRefundResponse {
  message?: unknown
  status?: string
  data?: {
    ref_id?: string
    reference?: string
    status?: string
  }
}

interface ChapaRefundVerifyResponse extends ChapaRefundResponse {
  data?: ChapaRefundResponse['data'] & {
    amount?: string
    currency?: string
  }
}

interface ChapaVerifyResponse {
  message: string
  status: string
  data?: {
    amount?: string
    currency?: string
    email?: string | null
    first_name?: string | null
    last_name?: string | null
    method?: string | null
    mode?: string | null
    payment_method?: string | null
    reference?: string | null
    status?: string | null
    tx_ref?: string | null
  }
}

interface VerifiedTransaction {
  amountMinor: number | null
  chapaReference?: string
  currency?: string
  mode?: string
  paymentMethod?: string
  status?: string
  txRef?: string
}

interface ReconcileResult {
  body: string
  statusCode: number
}

interface InitializeCheckoutResult {
  success: boolean
  checkoutUrl?: string
  error?: string
  txRef?: string
}

type CheckoutOrigin = 'web' | 'mobile'

// Reads a required server environment variable or fails configuration early
function getEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

// Converts a provider decimal amount into integer minor units
function parseMinorAmount(amount: string | null | undefined) {
  if (!amount) {
    return null
  }

  const parsed = Number(amount)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return Math.round(parsed * 100)
}

// Splits a guest name into the first and last names expected by Chapa
function splitName(fullName: string | null | undefined) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)

  return {
    firstName: parts[0] ?? 'Guest',
    lastName: parts.slice(1).join(' '),
  }
}

// Generates a booking-scoped Chapa transaction reference
function generateTxRef(bookingId: Id<'bookings'>) {
  return [
    'bkg',
    bookingId.slice(-8),
    Date.now().toString(36),
    crypto.randomBytes(3).toString('hex'),
  ].join('_')
}

// Extracts the first useful error message from a Chapa response
function extractChapaErrorMessage(
  message: unknown,
  fallback = 'Failed to initialize Chapa checkout.',
) {
  if (typeof message === 'string' && message.trim()) {
    return message
  }

  if (message && typeof message === 'object') {
    const record = message as Record<string, unknown>

    for (const value of Object.values(record)) {
      if (typeof value === 'string' && value.trim()) {
        return value
      }

      if (Array.isArray(value)) {
        const firstString = value.find(
          (entry): entry is string =>
            typeof entry === 'string' && entry.trim().length > 0,
        )

        if (firstString) {
          return firstString
        }
      }
    }
  }

  return fallback
}

// Generates the unique merchant reference that locks one refund attempt
function generateRefundReference(bookingId: Id<'bookings'>) {
  return [
    'refund',
    bookingId.slice(-8),
    Date.now().toString(36),
    crypto.randomBytes(3).toString('hex'),
  ].join('_')
}

// Normalizes Chapa's refund status vocabulary for the local lifecycle
function normalizeRefundStatus(status: string | undefined) {
  switch (status?.toLowerCase()) {
    case 'refunded':
    case 'success':
    case 'successful':
      return 'refunded' as const
    case 'reversed':
    case 'failed':
      return 'reversed' as const
    case 'initiated':
    case 'processing':
    case 'pending':
      return 'processing' as const
    default:
      return undefined
  }
}

// Compares equal-length hexadecimal signatures without leaking byte position
function timingSafeHexEqual(
  received: string | undefined,
  expected: string,
): boolean {
  if (!received || !/^[0-9a-f]+$/i.test(received)) {
    return false
  }

  const receivedBytes = Buffer.from(received, 'hex')
  const expectedBytes = Buffer.from(expected, 'hex')

  return (
    receivedBytes.length === expectedBytes.length &&
    crypto.timingSafeEqual(receivedBytes, expectedBytes)
  )
}

// Accepts either Chapa signature header after constant-time verification
function verifyWebhookSignature(args: {
  body: string
  chapaSignature?: string
  secret: string
  xChapaSignature?: string
}) {
  const expectedKeySignature = crypto
    .createHmac('sha256', args.secret)
    .update(args.secret)
    .digest('hex')

  const expectedPayloadSignature = crypto
    .createHmac('sha256', args.secret)
    .update(args.body)
    .digest('hex')

  const chapaSignatureValid = timingSafeHexEqual(
    args.chapaSignature,
    expectedKeySignature,
  )
  const payloadSignatureValid = timingSafeHexEqual(
    args.xChapaSignature,
    expectedPayloadSignature,
  )

  return chapaSignatureValid || payloadSignatureValid
}

// Re-fetches a transaction from Chapa before trusting provider input
async function verifyTransactionWithChapa(txRef: string) {
  const trimmedRef = txRef.trim()
  if (
    trimmedRef.length < 6 ||
    trimmedRef.length > 100 ||
    !/^[A-Za-z0-9_-]+$/.test(trimmedRef)
  ) {
    console.error('Skipping Chapa verify with invalid txRef shape')
    return null
  }
  const secretKey = getEnv('CHAPA_SECRET_KEY')

  try {
    const response = await fetch(
      `${CHAPA_API_BASE}/transaction/verify/${trimmedRef}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
        method: 'GET',
        signal: AbortSignal.timeout(30_000),
      },
    )

    let data: ChapaVerifyResponse
    try {
      data = (await response.json()) as ChapaVerifyResponse
    } catch (error) {
      console.error('Chapa verify returned non-JSON payload', error)
      return null
    }

    if (!response.ok || data.status !== 'success' || !data.data) {
      return null
    }

    return {
      amountMinor: parseMinorAmount(data.data.amount),
      chapaReference: data.data.reference ?? undefined,
      currency: data.data.currency ?? undefined,
      mode: data.data.mode ?? undefined,
      paymentMethod: data.data.payment_method ?? data.data.method ?? undefined,
      status: data.data.status ?? undefined,
      txRef: data.data.tx_ref ?? undefined,
    } satisfies VerifiedTransaction
  } catch (error) {
    console.error('Chapa verify request failed', error)
    return null
  }
}

// Maps a Chapa event name to its local payment status
function getStatusFromEvent(event: string | undefined) {
  switch (event) {
    case 'charge.success':
      return 'paid'
    // Chapa names its refund webhooks refund.*, so charge.refunded alone would
    // never match a real refund notification
    case 'charge.refunded':
    case 'refund.success':
      return 'refunded'
    case 'charge.reversed':
    case 'refund.reversed':
    case 'refund.failed':
      return 'reversed'
    case 'charge.failed/cancelled':
      return 'failed'
    default:
      return undefined
  }
}

// Maps a verified provider status to its local payment status
function getStatusFromProvider(status: string | undefined) {
  switch (status) {
    case 'success':
      return 'paid'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    case 'failed/cancelled':
      return 'failed'
    case 'refunded':
      return 'refunded'
    case 'reversed':
      return 'reversed'
    default:
      return undefined
  }
}

// Moves the booking off its in-flight refund state once the payment row records
// a settled refund, otherwise a completed refund keeps reading as processing
async function propagateRefundOutcome(
  ctx: any,
  args: {
    booking: Doc<'bookings'> | null
    payment: Doc<'chapaPayments'> | null
    txRef: string
  },
) {
  const { booking, payment } = args

  if (
    !booking ||
    !payment ||
    (payment.status !== 'refunded' && payment.status !== 'reversed')
  ) {
    return
  }

  await ctx.runMutation(internal.bookings.applyChapaRefundOutcome, {
    bookingId: booking._id,
    outcome: payment.status,
    txRef: args.txRef,
    refundReference: payment.refundReference,
    refundRefId: payment.refundRefId,
    error:
      payment.status === 'reversed'
        ? 'Chapa reversed the refund before it completed.'
        : undefined,
  })
}

// Reconciles one provider event against its stored payment and booking
async function reconcileTransaction(
  ctx: any,
  args: {
    event?: string
    payload: unknown
    source: ReconcileSource
    txRef: string
  },
): Promise<ReconcileResult> {
  const expectedMode = getEnv('CHAPA_EXPECTED_MODE')
  const payment = await ctx.runQuery(internal.chapaInternal.getByTxRef, {
    txRef: args.txRef,
  })

  if (!payment) {
    return {
      body: 'Payment not found',
      statusCode: 404,
    }
  }

  const booking = await ctx.runQuery(internal.bookings.getBookingById, {
    bookingId: payment.bookingId,
  })

  if (
    booking &&
    payment.status === 'paid' &&
    booking.paymentStatus !== 'paid' &&
    ['confirmed', 'checked_in', 'checked_out'].includes(booking.status)
  ) {
    await ctx.runMutation(internal.bookings.applyChapaPaymentStatus, {
      bookingId: booking._id,
      paymentStatus: 'paid',
    })
  }

  const eventStatus = getStatusFromEvent(args.event)

  if (eventStatus === 'refunded' || eventStatus === 'reversed') {
    const refundedAt = Date.now()

    const updatedPayment = await ctx.runMutation(
      internal.chapaInternal.updatePaymentRecord,
      {
        txRef: args.txRef,
        status: eventStatus,
        event: args.event,
        payload: args.payload,
        providerStatus: eventStatus,
        refundedAt,
        source: args.source,
      },
    )

    await propagateRefundOutcome(ctx, {
      booking,
      payment: updatedPayment,
      txRef: payment.txRef,
    })

    return {
      body: 'OK',
      statusCode: 200,
    }
  }

  const verification = await verifyTransactionWithChapa(args.txRef)

  if (!verification) {
    await ctx.runMutation(internal.chapaInternal.updatePaymentRecord, {
      txRef: args.txRef,
      event: args.event,
      lastError: 'Failed to verify transaction with Chapa.',
      payload: args.payload,
      source: args.source,
    })

    return {
      body: 'Verification failed',
      statusCode: 400,
    }
  }

  if (
    verification.txRef !== payment.txRef ||
    verification.amountMinor !== payment.chargedAmountMinor ||
    verification.currency !== payment.chargedCurrency ||
    verification.mode !== expectedMode
  ) {
    await ctx.runMutation(internal.chapaInternal.updatePaymentRecord, {
      txRef: args.txRef,
      chapaReference: verification.chapaReference,
      event: args.event,
      lastError:
        'Verification mismatch for tx_ref, amount, currency, or provider mode.',
      payload: args.payload,
      paymentMethod: verification.paymentMethod,
      providerMode:
        verification.mode === 'test' || verification.mode === 'live'
          ? verification.mode
          : undefined,
      providerStatus: verification.status,
      source: args.source,
      verifiedAt: Date.now(),
    })

    return {
      body: 'Verification mismatch',
      statusCode: 400,
    }
  }

  const resolvedStatus =
    eventStatus ?? getStatusFromProvider(verification.status)

  if (!resolvedStatus) {
    await ctx.runMutation(internal.chapaInternal.updatePaymentRecord, {
      txRef: args.txRef,
      chapaReference: verification.chapaReference,
      event: args.event,
      lastError: `Unsupported transaction status '${verification.status ?? 'unknown'}'.`,
      payload: args.payload,
      paymentMethod: verification.paymentMethod,
      providerMode:
        verification.mode === 'test' || verification.mode === 'live'
          ? verification.mode
          : undefined,
      providerStatus: verification.status,
      source: args.source,
      verifiedAt: Date.now(),
    })

    return {
      body: 'Unsupported status',
      statusCode: 202,
    }
  }

  if (resolvedStatus === 'paid') {
    const confirmation = booking
      ? await ctx.runMutation(internal.bookings.confirmChapaPayment, {
          bookingId: booking._id,
          chapaReference: verification.chapaReference ?? payment.txRef,
        })
      : 'booking_missing'

    const paymentStatus =
      confirmation === 'confirmed' ||
      confirmation === 'already_confirmed' ||
      confirmation === 'synchronized'
        ? 'paid'
        : 'refund_required'

    await ctx.runMutation(internal.chapaInternal.updatePaymentRecord, {
      txRef: args.txRef,
      status: paymentStatus,
      chapaReference: verification.chapaReference,
      event: args.event,
      lastError:
        paymentStatus === 'refund_required'
          ? 'Payment succeeded after the booking was no longer confirmable.'
          : undefined,
      payload: args.payload,
      paymentMethod: verification.paymentMethod,
      providerMode:
        verification.mode === 'test' || verification.mode === 'live'
          ? verification.mode
          : undefined,
      providerStatus: verification.status,
      source: args.source,
      verifiedAt: Date.now(),
    })

    if (paymentStatus === 'refund_required' && booking) {
      // Surface late or duplicate Chapa charges as staff refund work
      await ctx.runMutation(internal.bookings.markChapaRefundRequired, {
        bookingId: booking._id,
        txRef: payment.txRef,
      })
    }

    return {
      body: 'OK',
      statusCode: 200,
    }
  }

  const settledRefund =
    resolvedStatus === 'refunded' || resolvedStatus === 'reversed'

  const updatedPayment = await ctx.runMutation(
    internal.chapaInternal.updatePaymentRecord,
    {
      txRef: args.txRef,
      status: resolvedStatus,
      chapaReference: verification.chapaReference,
      event: args.event,
      payload: args.payload,
      paymentMethod: verification.paymentMethod,
      providerMode:
        verification.mode === 'test' || verification.mode === 'live'
          ? verification.mode
          : undefined,
      providerStatus: verification.status,
      refundedAt: settledRefund ? Date.now() : undefined,
      source: args.source,
      verifiedAt: Date.now(),
    },
  )

  if (
    booking &&
    updatedPayment &&
    (updatedPayment.status === 'failed' ||
      updatedPayment.status === 'cancelled')
  ) {
    await ctx.runMutation(internal.bookings.applyChapaPaymentStatus, {
      bookingId: booking._id,
      paymentStatus: 'failed',
    })
  }

  // A refund Chapa only admits to on verification still has to reach the booking
  await propagateRefundOutcome(ctx, {
    booking,
    payment: updatedPayment,
    txRef: payment.txRef,
  })

  return {
    body: 'OK',
    statusCode: 200,
  }
}

// Lets an authorized hotel administrator submit one full Chapa refund
export const initiateRefund = action({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.object({
    success: v.boolean(),
    state: v.union(
      v.literal('processing'),
      v.literal('refunded'),
      v.literal('verification_required'),
      v.literal('required'),
    ),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const secretKey = getEnv('CHAPA_SECRET_KEY')
    const reservation = await ctx.runMutation(
      internal.chapaInternal.reserveRefund,
      {
        bookingId: args.bookingId,
        refundReference: generateRefundReference(args.bookingId),
      },
    )

    if (reservation.state === 'refunded') {
      return { success: true, state: 'refunded' as const }
    }

    if (reservation.state === 'processing') {
      return { success: true, state: 'processing' as const }
    }

    if (reservation.state === 'verification_required') {
      return {
        success: false,
        state: 'verification_required' as const,
        error: 'Check the Chapa dashboard before taking any further action.',
      }
    }

    const body = new URLSearchParams({
      amount: (reservation.amountMinor / 100).toFixed(2),
      reason: `Full refund for booking ${reservation.bookingId}`,
      reference: reservation.refundReference,
    })

    let response: Response
    let data: ChapaRefundResponse

    try {
      // Address the refund by Chapa's own payment reference, which is what the
      // endpoint resolves, and submit the stored ETB charge rather than
      // recomputing it from current FX
      response = await fetch(
        `${CHAPA_API_BASE}/refund/${encodeURIComponent(reservation.chapaReference)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
          signal: AbortSignal.timeout(30_000),
        },
      )
      data = (await response.json()) as ChapaRefundResponse
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Chapa returned an unreadable refund response.'

      // A transport failure may hide an accepted refund, so block every retry
      await ctx.runMutation(
        internal.chapaInternal.markRefundVerificationRequired,
        {
          txRef: reservation.txRef,
          refundReference: reservation.refundReference,
          error: message,
        },
      )

      return {
        success: false,
        state: 'verification_required' as const,
        error:
          'Chapa may have accepted the refund. Check the dashboard before taking any further action.',
      }
    }

    const providerStatus = normalizeRefundStatus(
      data.data?.status ?? data.status,
    )
    const refundRefId = data.data?.ref_id

    if (!response.ok || data.status === 'failed') {
      const error = extractChapaErrorMessage(
        data.message,
        'Chapa rejected the refund request.',
      )

      if (response.status >= 500) {
        // Server errors are ambiguous because Chapa may have accepted the POST
        await ctx.runMutation(
          internal.chapaInternal.markRefundVerificationRequired,
          {
            txRef: reservation.txRef,
            refundReference: reservation.refundReference,
            error,
          },
        )

        return {
          success: false,
          state: 'verification_required' as const,
          error:
            'Chapa may have accepted the refund. Check the dashboard before taking any further action.',
        }
      }

      // A provider 4xx is a proven rejection and is safe for a later retry
      await ctx.runMutation(internal.chapaInternal.rejectRefund, {
        txRef: reservation.txRef,
        refundReference: reservation.refundReference,
        error,
      })

      return { success: false, state: 'required' as const, error }
    }

    // Chapa routinely accepts a refund without echoing ref_id, so fall back to
    // the payment reference the endpoint already resolved rather than stranding
    // an accepted refund in manual verification
    const verificationRef = refundRefId ?? reservation.chapaReference

    // Save the verification handle before returning because it is the only way
    // to poll this refund later
    await ctx.runMutation(internal.chapaInternal.recordRefundAcceptance, {
      txRef: reservation.txRef,
      refundReference: reservation.refundReference,
      refundRefId: verificationRef,
    })

    if (providerStatus === 'refunded' || providerStatus === 'reversed') {
      await ctx.runMutation(internal.chapaInternal.applyVerifiedRefund, {
        txRef: reservation.txRef,
        refundRefId: verificationRef,
        status: providerStatus,
        payload: data,
      })
    }

    return {
      success: true,
      state:
        providerStatus === 'refunded'
          ? ('refunded' as const)
          : ('processing' as const),
    }
  },
})

// Polls accepted Chapa refunds so missed webhooks cannot strand them forever
export const verifyPendingRefunds = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const secretKey = getEnv('CHAPA_SECRET_KEY')
    const payments = await ctx.runQuery(
      internal.chapaInternal.listRefundsToVerify,
      {},
    )
    // Repair first, so a booking whose payment row already settled is fixed even
    // when no refund is left to poll
    let updatedCount: number = await ctx.runMutation(
      internal.chapaInternal.settleDriftedRefunds,
      {},
    )

    // Verify each bounded item independently so one provider error does not stop the batch
    for (const payment of payments) {
      if (!payment.refundRefId) continue

      try {
        const response = await fetch(
          `${CHAPA_API_BASE}/refund/${encodeURIComponent(payment.refundRefId)}/verify`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${secretKey}` },
            signal: AbortSignal.timeout(30_000),
          },
        )
        const data = (await response.json()) as ChapaRefundVerifyResponse
        const status = normalizeRefundStatus(data.data?.status ?? data.status)
        const amountMinor = parseMinorAmount(data.data?.amount)

        if (
          !response.ok ||
          !status ||
          (amountMinor !== null && amountMinor !== payment.refundAmountMinor) ||
          (data.data?.currency &&
            data.data.currency !== payment.chargedCurrency)
        ) {
          continue
        }

        await ctx.runMutation(internal.chapaInternal.applyVerifiedRefund, {
          txRef: payment.txRef,
          refundRefId: payment.refundRefId,
          status,
          payload: data,
        })

        // Only a settled result counts, otherwise a refund Chapa leaves
        // initiated would report progress on every single poll
        if (status !== 'processing') {
          updatedCount += 1
        }
      } catch (error) {
        console.error(
          `Failed to verify Chapa refund ${payment.refundRefId}:`,
          error,
        )
      }
    }

    return updatedCount
  },
})

// Lets a signed-in booking owner initialize or reuse one hosted checkout
export const initializeHostedCheckout = action({
  args: {
    bookingId: v.id('bookings'),
    origin: v.optional(v.union(v.literal('web'), v.literal('mobile'))),
  },
  returns: v.object({
    success: v.boolean(),
    checkoutUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    txRef: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<InitializeCheckoutResult> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to pay for this booking.',
      })
    }

    const secretKey = getEnv('CHAPA_SECRET_KEY')
    const appBaseUrl = getEnv('APP_BASE_URL')
    const callbackBaseUrl = getEnv('CHAPA_CALLBACK_BASE_URL')
    const providerMode = getEnv('CHAPA_EXPECTED_MODE')
    const brandName = getEnv('CHAPA_BRAND_NAME')
    const fxRate = Number(getEnv('CHAPA_FIXED_ETB_PER_USD'))
    const origin: CheckoutOrigin = args.origin ?? 'web'

    if (!Number.isFinite(fxRate) || fxRate <= 0) {
      throw new Error('CHAPA_FIXED_ETB_PER_USD must be a positive number')
    }

    // Atomically reserve the one checkout attempt allowed to contact Chapa
    const reservation = await ctx.runMutation(
      internal.chapaInternal.reserveHostedCheckout,
      {
        bookingId: args.bookingId,
        txRef: generateTxRef(args.bookingId),
        fxRateEtbPerUsd: fxRate,
        providerMode: providerMode === 'live' ? 'live' : 'test',
        origin,
      },
    )

    if (reservation.state === 'invalid_email') {
      return {
        success: false,
        error: 'A guest email is required before starting payment.',
      }
    }

    if (reservation.state === 'initialized') {
      return {
        success: true,
        checkoutUrl: reservation.checkoutUrl,
        txRef: reservation.txRef,
      }
    }

    if (reservation.state === 'initializing') {
      return {
        success: false,
        error: 'Your secure checkout is already being prepared. Please retry.',
        txRef: reservation.txRef,
      }
    }

    const amount = (reservation.chargedAmountMinor / 100).toFixed(2)
    const callbackUrl = `${callbackBaseUrl}/chapa/callback`
    const returnUrl =
      reservation.origin === 'mobile'
        ? `${callbackBaseUrl}/chapa/mobile-return?tx_ref=${encodeURIComponent(reservation.txRef)}`
        : `${appBaseUrl}/bookings?payment=processing&tx_ref=${encodeURIComponent(reservation.txRef)}`
    const { firstName, lastName } = splitName(reservation.guestName)

    let response: Response
    let data: ChapaInitializeResponse

    try {
      // Ask Chapa for a hosted page only after this caller wins the reservation
      response = await fetch(`${CHAPA_API_BASE}/transaction/initialize`, {
        body: JSON.stringify({
          amount,
          callback_url: callbackUrl,
          currency: 'ETB',
          customization: {
            description: `Booking ${args.bookingId.slice(-6).toUpperCase()} from ${reservation.checkIn} to ${reservation.checkOut}`,
            title: brandName,
          },
          email: reservation.email,
          first_name: firstName,
          last_name: lastName,
          meta: {
            bookingAmountCents: reservation.bookingAmountCents,
            bookingId: args.bookingId,
            fxRateEtbPerUsd: reservation.fxRateEtbPerUsd,
          },
          return_url: returnUrl,
          tx_ref: reservation.txRef,
        }),
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
      })

      data = (await response.json()) as ChapaInitializeResponse
    } catch (error) {
      // Release transport and response failures because no checkout URL reached the customer
      await ctx.runMutation(internal.chapaInternal.failHostedCheckout, {
        txRef: reservation.txRef,
        error:
          error instanceof Error
            ? error.message
            : 'Chapa checkout initialization failed.',
      })

      return {
        success: false,
        error: 'Unable to prepare secure checkout. Please try again.',
        txRef: reservation.txRef,
      }
    }

    if (!response.ok || data.status !== 'success' || !data.data?.checkout_url) {
      const error = extractChapaErrorMessage(data.message)
      // Release definitive provider failures so the customer may retry
      await ctx.runMutation(internal.chapaInternal.failHostedCheckout, {
        txRef: reservation.txRef,
        error,
      })

      return {
        success: false,
        error,
      }
    }

    // Finalize the reservation and create its canonical payment record atomically
    const finalized = await ctx.runMutation(
      internal.chapaInternal.finalizeHostedCheckout,
      {
        txRef: reservation.txRef,
        checkoutUrl: data.data.checkout_url,
      },
    )

    return {
      success: true,
      checkoutUrl: finalized.checkoutUrl,
      txRef: finalized.txRef,
    }
  },
})

// Reconciles a webhook forwarded by the internal Chapa HTTP handler
export const processWebhook = internalAction({
  args: {
    body: v.string(),
    chapaSignature: v.optional(v.string()),
    xChapaSignature: v.optional(v.string()),
  },
  returns: v.object({
    body: v.string(),
    statusCode: v.number(),
  }),
  handler: async (ctx, args): Promise<ReconcileResult> => {
    const webhookSecret = getEnv('CHAPA_WEBHOOK_SECRET')

    if (
      !verifyWebhookSignature({
        body: args.body,
        chapaSignature: args.chapaSignature,
        secret: webhookSecret,
        xChapaSignature: args.xChapaSignature,
      })
    ) {
      return {
        body: 'Invalid signature',
        statusCode: 400,
      }
    }

    let payload: Record<string, unknown>

    try {
      payload = JSON.parse(args.body) as Record<string, unknown>
    } catch {
      return {
        body: 'Invalid JSON',
        statusCode: 400,
      }
    }

    const txRef =
      typeof payload.tx_ref === 'string'
        ? payload.tx_ref
        : typeof payload.trx_ref === 'string'
          ? payload.trx_ref
          : null

    if (!txRef) {
      return {
        body: 'Missing tx_ref',
        statusCode: 400,
      }
    }

    return await reconcileTransaction(ctx, {
      event: typeof payload.event === 'string' ? payload.event : undefined,
      payload,
      source: 'webhook',
      txRef,
    })
  },
})

// Reconciles a callback forwarded by the internal Chapa HTTP handler
export const processCallback = internalAction({
  args: {
    refId: v.optional(v.string()),
    status: v.optional(v.string()),
    txRef: v.string(),
  },
  returns: v.object({
    body: v.string(),
    statusCode: v.number(),
  }),
  handler: async (ctx, args): Promise<ReconcileResult> => {
    return await reconcileTransaction(ctx, {
      payload: {
        ref_id: args.refId,
        status: args.status,
        tx_ref: args.txRef,
      },
      source: 'callback',
      txRef: args.txRef,
    })
  },
})
