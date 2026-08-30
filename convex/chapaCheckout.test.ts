/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

/** Creates one owned, live booking hold for checkout reservation tests. */
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
      roomNumber: '301',
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
      checkIn: '2027-01-10',
      checkOut: '2027-01-12',
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

/** Returns an authenticated Convex test client for the seeded customer. */
function asCheckoutCustomer(t: ReturnType<typeof convexTest>) {
  return t.withIdentity({
    subject: 'checkout-customer',
    email: 'customer@example.com',
    emailVerified: true,
  })
}

describe('Chapa checkout reservations', () => {
  it('allows only one concurrent caller to reserve the provider request', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedHeldBooking(t)
    const customer = asCheckoutCustomer(t)

    const [first, second] = await Promise.all([
      customer.mutation(internal.chapaInternal.reserveHostedCheckout, {
        bookingId,
        txRef: 'checkout-first',
        fxRateEtbPerUsd: 140,
        providerMode: 'test',
        origin: 'web',
      }),
      customer.mutation(internal.chapaInternal.reserveHostedCheckout, {
        bookingId,
        txRef: 'checkout-second',
        fxRateEtbPerUsd: 140,
        providerMode: 'test',
        origin: 'web',
      }),
    ])

    expect([first.state, second.state].sort()).toEqual([
      'initializing',
      'reserved',
    ])
    expect(first.txRef).toBe(second.txRef)

    const attempts = await t.run((ctx) =>
      ctx.db.query('chapaCheckoutAttempts').collect(),
    )
    expect(attempts).toHaveLength(1)
  })

  it('finalizes the reserved pricing snapshot once and reuses its checkout', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedHeldBooking(t)
    const customer = asCheckoutCustomer(t)

    const reserved = await customer.mutation(
      internal.chapaInternal.reserveHostedCheckout,
      {
        bookingId,
        txRef: 'checkout-stable',
        fxRateEtbPerUsd: 140,
        providerMode: 'test',
        origin: 'mobile',
      },
    )
    expect(reserved.state).toBe('reserved')

    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, { totalPrice: 99999 })
    })

    await customer.mutation(internal.chapaInternal.finalizeHostedCheckout, {
      txRef: 'checkout-stable',
      checkoutUrl: 'https://checkout.chapa.test/stable',
    })

    const repeated = await customer.mutation(
      internal.chapaInternal.reserveHostedCheckout,
      {
        bookingId,
        txRef: 'checkout-ignored',
        fxRateEtbPerUsd: 150,
        providerMode: 'live',
        origin: 'web',
      },
    )
    expect(repeated).toEqual({
      state: 'initialized',
      txRef: 'checkout-stable',
      checkoutUrl: 'https://checkout.chapa.test/stable',
    })

    const payments = await t.run((ctx) =>
      ctx.db.query('chapaPayments').collect(),
    )
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({
      txRef: 'checkout-stable',
      bookingAmountCents: 20000,
      chargedAmountMinor: 2800000,
      fxRateEtbPerUsd: 140,
    })
  })

  it('allows a fresh reservation after a provider rejection', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedHeldBooking(t)
    const customer = asCheckoutCustomer(t)

    await customer.mutation(internal.chapaInternal.reserveHostedCheckout, {
      bookingId,
      txRef: 'checkout-rejected',
      fxRateEtbPerUsd: 140,
      providerMode: 'test',
      origin: 'web',
    })
    await customer.mutation(internal.chapaInternal.failHostedCheckout, {
      txRef: 'checkout-rejected',
      error: 'Provider rejected initialization.',
    })

    const retry = await customer.mutation(
      internal.chapaInternal.reserveHostedCheckout,
      {
        bookingId,
        txRef: 'checkout-retry',
        fxRateEtbPerUsd: 140,
        providerMode: 'test',
        origin: 'web',
      },
    )
    expect(retry).toMatchObject({
      state: 'reserved',
      txRef: 'checkout-retry',
    })

    const attempts = await t.run((ctx) =>
      ctx.db.query('chapaCheckoutAttempts').collect(),
    )
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([
      'failed',
      'initializing',
    ])
  })

  it('reuses an initializing attempt younger than 90 seconds', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedHeldBooking(t)
    const customer = asCheckoutCustomer(t)

    await t.run(async (ctx) => {
      const recentAt = Date.now() - 89_000
      await ctx.db.insert('chapaCheckoutAttempts', {
        bookingId,
        txRef: 'checkout-recent',
        bookingAmountCents: 20000,
        bookingCurrency: 'USD',
        chargedAmountMinor: 2800000,
        chargedCurrency: 'ETB',
        fxRateEtbPerUsd: 140,
        providerMode: 'test',
        origin: 'web',
        status: 'initializing',
        createdAt: recentAt,
        updatedAt: recentAt,
      })
    })

    const blocked = await customer.mutation(
      internal.chapaInternal.reserveHostedCheckout,
      {
        bookingId,
        txRef: 'checkout-blocked',
        fxRateEtbPerUsd: 140,
        providerMode: 'test',
        origin: 'web',
      },
    )

    expect(blocked).toEqual({
      state: 'initializing',
      txRef: 'checkout-recent',
    })
    const attempts = await t.run((ctx) =>
      ctx.db.query('chapaCheckoutAttempts').collect(),
    )
    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({ status: 'initializing' })
  })

  it('fails and replaces an initializing attempt older than 90 seconds', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedHeldBooking(t)
    const customer = asCheckoutCustomer(t)

    await t.run(async (ctx) => {
      const staleAt = Date.now() - 91_000
      await ctx.db.insert('chapaCheckoutAttempts', {
        bookingId,
        txRef: 'checkout-stale',
        bookingAmountCents: 20000,
        bookingCurrency: 'USD',
        chargedAmountMinor: 2800000,
        chargedCurrency: 'ETB',
        fxRateEtbPerUsd: 140,
        providerMode: 'test',
        origin: 'web',
        status: 'initializing',
        createdAt: staleAt,
        updatedAt: staleAt,
      })
    })

    const replacement = await customer.mutation(
      internal.chapaInternal.reserveHostedCheckout,
      {
        bookingId,
        txRef: 'checkout-replacement',
        fxRateEtbPerUsd: 140,
        providerMode: 'test',
        origin: 'web',
      },
    )

    expect(replacement).toMatchObject({
      state: 'reserved',
      txRef: 'checkout-replacement',
    })
    const attempts = await t.run((ctx) =>
      ctx.db.query('chapaCheckoutAttempts').collect(),
    )
    expect(attempts).toHaveLength(2)
    expect(
      attempts.find((attempt) => attempt.txRef === 'checkout-stale'),
    ).toMatchObject({
      status: 'failed',
      lastError: 'Checkout initialization timed out before finalization.',
    })
    expect(
      attempts.find((attempt) => attempt.txRef === 'checkout-replacement'),
    ).toMatchObject({ status: 'initializing' })
  })
})
