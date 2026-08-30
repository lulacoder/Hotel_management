/// <reference types="vite/client" />
// @vitest-environment node
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

const CHAPA_ENV = {
  APP_BASE_URL: 'https://app.test',
  CHAPA_BRAND_NAME: 'Test Hotels',
  CHAPA_CALLBACK_BASE_URL: 'https://api.test',
  CHAPA_EXPECTED_MODE: 'test',
  CHAPA_FIXED_ETB_PER_USD: '140',
  CHAPA_SECRET_KEY: 'CHASECK_TEST-secret',
} as const

/** Creates one owned, live booking hold that a checkout action can pay for. */
async function seedHeldBooking(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert('users', {
      clerkUserId: 'checkout-customer',
      email: 'customer@example.com',
      role: 'customer',
      createdAt: now,
    })
    const hotelId = await ctx.db.insert('hotels', {
      name: 'Checkout Hotel',
      address: 'Bole Road',
      city: 'Addis Ababa',
      country: 'Ethiopia',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
    const roomId = await ctx.db.insert('rooms', {
      hotelId,
      roomNumber: '401',
      type: 'standard',
      basePrice: 10000,
      maxOccupancy: 2,
      operationalStatus: 'available',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
    const bookingId = await ctx.db.insert('bookings', {
      userId,
      roomId,
      hotelId,
      checkIn: '2027-03-10',
      checkOut: '2027-03-12',
      status: 'held',
      holdExpiresAt: now + 15 * 60 * 1000,
      paymentStatus: 'pending',
      pricePerNight: 10000,
      totalPrice: 20000,
      guestName: 'Test Customer',
      createdAt: now,
      updatedAt: now,
    })

    return { bookingId }
  })
}

describe('Chapa checkout initialization failures', () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(CHAPA_ENV)) {
      vi.stubEnv(name, value)
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('releases the reservation when the provider request throws', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedHeldBooking(t)
    const customer = t.withIdentity({
      subject: 'checkout-customer',
      email: 'customer@example.com',
      emailVerified: true,
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('The operation was aborted'))),
    )

    const result = await customer.action(
      api.chapaActions.initializeHostedCheckout,
      { bookingId },
    )

    expect(result.success).toBe(false)
    expect(result.checkoutUrl).toBeUndefined()

    const attempts = await t.run((ctx) =>
      ctx.db.query('chapaCheckoutAttempts').collect(),
    )
    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({
      status: 'failed',
      lastError: 'The operation was aborted',
    })

    // No payment row may exist because no checkout URL reached the customer
    const payments = await t.run((ctx) =>
      ctx.db.query('chapaPayments').collect(),
    )
    expect(payments).toHaveLength(0)
  })

  it('lets the customer retry immediately after a thrown provider request', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedHeldBooking(t)
    const customer = t.withIdentity({
      subject: 'checkout-customer',
      email: 'customer@example.com',
      emailVerified: true,
    })

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            message: 'Hosted Link',
            data: { checkout_url: 'https://checkout.chapa.test/retry' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const failed = await customer.action(
      api.chapaActions.initializeHostedCheckout,
      { bookingId },
    )
    expect(failed.success).toBe(false)

    const retried = await customer.action(
      api.chapaActions.initializeHostedCheckout,
      { bookingId },
    )
    expect(retried).toMatchObject({
      success: true,
      checkoutUrl: 'https://checkout.chapa.test/retry',
    })

    const attempts = await t.run((ctx) =>
      ctx.db.query('chapaCheckoutAttempts').collect(),
    )
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([
      'failed',
      'initialized',
    ])

    const payments = await t.run((ctx) =>
      ctx.db.query('chapaPayments').collect(),
    )
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({
      status: 'initialized',
      checkoutUrl: 'https://checkout.chapa.test/retry',
      chargedAmountMinor: 2800000,
    })
  })
})
