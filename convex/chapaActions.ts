'use node'

import * as crypto from 'crypto'

import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'
import type { Id } from './_generated/dataModel'

const CHAPA_API_BASE = 'https://api.chapa.co/v1'

type ReconcileSource = 'webhook' | 'callback'

interface ChapaInitializeResponse {
  message: unknown
  status: string
  data?: {
    checkout_url?: string
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

function getEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

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

function splitName(fullName: string | null | undefined) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)

  return {
    firstName: parts[0] ?? 'Guest',
    lastName: parts.slice(1).join(' '),
  }
}

function generateTxRef(bookingId: Id<'bookings'>) {
  return [
    'bkg',
    bookingId.slice(-8),
    Date.now().toString(36),
    crypto.randomBytes(3).toString('hex'),
  ].join('_')
}

function extractChapaErrorMessage(message: unknown) {
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
          (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
        )

        if (firstString) {
          return firstString
        }
      }
    }
  }

  return 'Failed to initialize Chapa checkout.'
}

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

  const chapaSignatureValid =
    Boolean(args.chapaSignature) && args.chapaSignature === expectedKeySignature
  const payloadSignatureValid =
    Boolean(args.xChapaSignature) &&
    args.xChapaSignature === expectedPayloadSignature

  return chapaSignatureValid || payloadSignatureValid
}

async function verifyTransactionWithChapa(txRef: string) {
  const secretKey = getEnv('CHAPA_SECRET_KEY')

  const response = await fetch(`${CHAPA_API_BASE}/transaction/verify/${txRef}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
    method: 'GET',
  })

  const data = (await response.json()) as ChapaVerifyResponse

  if (!response.ok || data.status !== 'success' || !data.data) {
    return null
  }

  return {
    amountMinor: parseMinorAmount(data.data.amount),
    chapaReference: data.data.reference ?? undefined,
    currency: data.data.currency ?? undefined,
    mode: data.data.mode ?? undefined,
    paymentMethod:
      data.data.payment_method ?? data.data.method ?? undefined,
    status: data.data.status ?? undefined,
    txRef: data.data.tx_ref ?? undefined,
  } satisfies VerifiedTransaction
}

function getStatusFromEvent(event: string | undefined) {
  switch (event) {
    case 'charge.success':
      return 'paid'
    case 'charge.refunded':
      return 'refunded'
    case 'charge.reversed':
      return 'reversed'
    case 'charge.failed/cancelled':
      return 'failed'
    default:
      return undefined
  }
}

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

    const updatedPayment = await ctx.runMutation(internal.chapaInternal.updatePaymentRecord, {
      txRef: args.txRef,
      status: eventStatus,
      event: args.event,
      payload: args.payload,
      providerStatus: eventStatus,
      refundedAt,
      source: args.source,
    })

    if (
      booking &&
      updatedPayment &&
      (updatedPayment.status === 'refunded' || updatedPayment.status === 'reversed')
    ) {
      await ctx.runMutation(internal.bookings.applyChapaPaymentStatus, {
        bookingId: booking._id,
        paymentStatus:
          updatedPayment.status === 'refunded' ? 'refunded' : 'failed',
      })
    }

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

    return {
      body: 'OK',
      statusCode: 200,
    }
  }

  const updatedPayment = await ctx.runMutation(internal.chapaInternal.updatePaymentRecord, {
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
    source: args.source,
    verifiedAt: Date.now(),
  })

  if (
    booking &&
    updatedPayment &&
    (updatedPayment.status === 'failed' || updatedPayment.status === 'cancelled')
  ) {
    await ctx.runMutation(internal.bookings.applyChapaPaymentStatus, {
      bookingId: booking._id,
      paymentStatus: 'failed',
    })
  }

  return {
    body: 'OK',
    statusCode: 200,
  }
}

export const initializeHostedCheckout = action({
  args: {
    bookingId: v.id('bookings'),
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

    const currentUser = await ctx.runQuery(internal.users.getByClerkUserId, {
      clerkUserId: identity.subject,
    })
    const booking = await ctx.runQuery(internal.bookings.getBookingById, {
      bookingId: args.bookingId,
    })

    if (!currentUser || !booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      })
    }

    if (booking.userId !== currentUser._id) {
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

    if (booking.holdExpiresAt && booking.holdExpiresAt < Date.now()) {
      throw new ConvexError({
        code: 'EXPIRED',
        message: 'Your booking hold has expired.',
      })
    }

    const latestPayment = await ctx.runQuery(
      internal.chapaInternal.getLatestByBooking,
      {
        bookingId: args.bookingId,
      },
    )

    if (latestPayment?.status === 'initialized') {
      return {
        success: true,
        checkoutUrl: latestPayment.checkoutUrl,
        txRef: latestPayment.txRef,
      }
    }

    const secretKey = getEnv('CHAPA_SECRET_KEY')
    const appBaseUrl = getEnv('APP_BASE_URL')
    const callbackBaseUrl = getEnv('CHAPA_CALLBACK_BASE_URL')
    const providerMode = getEnv('CHAPA_EXPECTED_MODE')
    const brandName = getEnv('CHAPA_BRAND_NAME')
    const fxRate = Number(getEnv('CHAPA_FIXED_ETB_PER_USD'))

    if (!Number.isFinite(fxRate) || fxRate <= 0) {
      throw new Error('CHAPA_FIXED_ETB_PER_USD must be a positive number')
    }

    const txRef = generateTxRef(args.bookingId)
    const chargedAmountMinor = Math.round((booking.totalPrice / 100) * fxRate * 100)
    const amount = (chargedAmountMinor / 100).toFixed(2)
    const callbackUrl = `${callbackBaseUrl}/chapa/callback`
    const returnUrl = `${appBaseUrl}/bookings?payment=processing&tx_ref=${encodeURIComponent(txRef)}`
    const { firstName, lastName } = splitName(booking.guestName)
    const email = booking.guestEmail || currentUser.email

    if (!email) {
      return {
        success: false,
        error: 'A guest email is required before starting payment.',
      }
    }

    const response = await fetch(`${CHAPA_API_BASE}/transaction/initialize`, {
      body: JSON.stringify({
        amount,
        callback_url: callbackUrl,
        currency: 'ETB',
        customization: {
          description: `Booking ${args.bookingId.slice(-6).toUpperCase()} from ${booking.checkIn} to ${booking.checkOut}`,
          title: brandName,
        },
        email,
        first_name: firstName,
        last_name: lastName,
        meta: {
          bookingAmountCents: booking.totalPrice,
          bookingId: args.bookingId,
          fxRateEtbPerUsd: fxRate,
        },
        return_url: returnUrl,
        tx_ref: txRef,
      }),
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const data = (await response.json()) as ChapaInitializeResponse

    if (!response.ok || data.status !== 'success' || !data.data?.checkout_url) {
      return {
        success: false,
        error: extractChapaErrorMessage(data.message),
      }
    }

    await ctx.runMutation(internal.chapaInternal.createPaymentRecord, {
      bookingAmountCents: booking.totalPrice,
      bookingId: args.bookingId,
      chargedAmountMinor,
      checkoutUrl: data.data.checkout_url,
      fxRateEtbPerUsd: fxRate,
      providerMode: providerMode === 'live' ? 'live' : 'test',
      txRef,
    })

    return {
      success: true,
      checkoutUrl: data.data.checkout_url,
      txRef,
    }
  },
})

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
