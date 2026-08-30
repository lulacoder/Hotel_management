/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'
import type { Doc } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

const asUser = (
  t: ReturnType<typeof convexTest>,
  subject: string,
  email: string,
) => t.withIdentity({ subject, email, emailVerified: true })

interface BookingSeedOptions {
  status: Doc<'bookings'>['status']
  paymentStatus?: Doc<'bookings'>['paymentStatus']
  holdExpiresAt?: number
  proofReviewDeadline?: number
}

// Creates the minimum customer, admin, hotel, room, and booking records needed
// to exercise booking mutations through their real authentication checks.
const seedBooking = async (
  t: ReturnType<typeof convexTest>,
  options: BookingSeedOptions,
) =>
  await t.run(async (ctx) => {
    const now = Date.now()
    const customerId = await ctx.db.insert('users', {
      clerkUserId: 'customer',
      email: 'customer@example.com',
      role: 'customer',
      createdAt: now,
    })
    const adminId = await ctx.db.insert('users', {
      clerkUserId: 'admin',
      email: 'admin@example.com',
      role: 'room_admin',
      createdAt: now,
    })
    const hotelId = await ctx.db.insert('hotels', {
      name: 'Containment Test Hotel',
      address: 'Test Street',
      city: 'Addis Ababa',
      country: 'Ethiopia',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
    const roomId = await ctx.db.insert('rooms', {
      hotelId,
      roomNumber: '101',
      type: 'standard',
      basePrice: 10000,
      maxOccupancy: 2,
      operationalStatus: 'available',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
    const bookingId = await ctx.db.insert('bookings', {
      userId: customerId,
      roomId,
      hotelId,
      checkIn: '2030-01-10',
      checkOut: '2030-01-11',
      status: options.status,
      paymentStatus: options.paymentStatus,
      holdExpiresAt: options.holdExpiresAt,
      proofReviewDeadline: options.proofReviewDeadline,
      pricePerNight: 10000,
      totalPrice: 10000,
      createdAt: now,
      updatedAt: now,
    })

    return { adminId, bookingId, customerId, hotelId, roomId }
  })

describe('booking payment containment', () => {
  it(
    'removes hold expiry when a customer submits bank payment proof',
    { timeout: 15000 },
    async () => {
      const t = convexTest(schema, modules)
      const { bookingId } = await seedBooking(t, {
        status: 'held',
        paymentStatus: 'pending',
        holdExpiresAt: Date.now() + 15 * 60 * 1000,
      })
      const customer = asUser(t, 'customer', 'customer@example.com')

      await customer.mutation(api.bookings.submitPaymentProof, {
        bookingId,
        transactionId: ' BANK-123 ',
        nationalIdR2Key: 'booking-proofs/test-id.jpg',
      })

      const booking = await t.run(async (ctx) => await ctx.db.get(bookingId))
      expect(booking).toMatchObject({
        status: 'pending_payment',
        paymentStatus: 'pending',
        transactionId: 'BANK-123',
      })
      expect(booking?.holdExpiresAt).toBeUndefined()
      // The room stays blocked while staff review, so the block needs an end
      const hoursUntilDeadline =
        ((booking?.proofReviewDeadline ?? 0) - Date.now()) / (60 * 60 * 1000)
      expect(hoursUntilDeadline).toBeGreaterThan(23.9)
      expect(hoursUntilDeadline).toBeLessThanOrEqual(24)
    },
  )

  it('confirms a held booking when cash is accepted and records both changes once', async () => {
    const t = convexTest(schema, modules)
    const { adminId, bookingId } = await seedBooking(t, {
      status: 'held',
      paymentStatus: 'pending',
      holdExpiresAt: Date.now() + 15 * 60 * 1000,
    })
    const admin = asUser(t, 'admin', 'admin@example.com')

    await admin.mutation(api.bookings.acceptCashPayment, { bookingId })
    await admin.mutation(api.bookings.acceptCashPayment, { bookingId })

    const result = await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      const auditEvents = await ctx.db
        .query('auditEvents')
        .withIndex('by_target', (q) =>
          q.eq('targetType', 'booking').eq('targetId', bookingId),
        )
        .collect()
      return { auditEvents, booking }
    })

    expect(result.booking).toMatchObject({
      status: 'confirmed',
      paymentStatus: 'paid',
      updatedBy: adminId,
    })
    expect(result.booking?.holdExpiresAt).toBeUndefined()
    expect(result.auditEvents).toHaveLength(1)
    expect(
      JSON.parse(result.auditEvents[0].previousValue ?? '{}'),
    ).toMatchObject({
      status: 'held',
      paymentStatus: 'pending',
      holdExpiresAt: expect.any(Number),
    })
    expect(JSON.parse(result.auditEvents[0].newValue ?? '{}')).toEqual({
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      holdExpiresAt: null,
    })
  })

  it('expires only unpaid held or pending-payment bookings', async () => {
    const t = convexTest(schema, modules)
    const expiredAt = Date.now() - 60_000
    const {
      bookingId: paidHeldId,
      customerId,
      hotelId,
      roomId,
    } = await seedBooking(t, {
      status: 'held',
      paymentStatus: 'paid',
      holdExpiresAt: expiredAt,
    })

    const { unpaidHeldId, pendingPaymentId, reviewableId, confirmedId } =
      await t.run(async (ctx) => {
        const now = Date.now()
        const baseBooking = {
          userId: customerId,
          roomId,
          hotelId,
          checkIn: '2030-01-10',
          checkOut: '2030-01-11',
          paymentStatus: 'pending' as const,
          pricePerNight: 10000,
          totalPrice: 10000,
          createdAt: now,
          updatedAt: now,
        }
        const createdUnpaidHeldId = await ctx.db.insert('bookings', {
          ...baseBooking,
          status: 'held',
          holdExpiresAt: expiredAt,
        })
        // Submitting a proof clears the hold, so the review deadline is the
        // only clock left that can reclaim the room from a silent bank transfer
        const createdPendingPaymentId = await ctx.db.insert('bookings', {
          ...baseBooking,
          status: 'pending_payment',
          proofReviewDeadline: expiredAt,
        })
        const createdReviewableId = await ctx.db.insert('bookings', {
          ...baseBooking,
          status: 'pending_payment',
          proofReviewDeadline: now + 60_000,
        })
        const createdConfirmedId = await ctx.db.insert('bookings', {
          ...baseBooking,
          status: 'confirmed',
          holdExpiresAt: expiredAt,
        })
        return {
          confirmedId: createdConfirmedId,
          pendingPaymentId: createdPendingPaymentId,
          reviewableId: createdReviewableId,
          unpaidHeldId: createdUnpaidHeldId,
        }
      })

    const expiredCount = await t.mutation(
      internal.bookingsInternal.cleanupExpiredHolds,
      {},
    )

    expect(expiredCount).toBe(2)
    const { bookings, expiryAudits } = await t.run(async (ctx) => ({
      bookings: {
        paidHeld: await ctx.db.get(paidHeldId),
        unpaidHeld: await ctx.db.get(unpaidHeldId),
        pendingPayment: await ctx.db.get(pendingPaymentId),
        reviewable: await ctx.db.get(reviewableId),
        confirmed: await ctx.db.get(confirmedId),
      },
      expiryAudits: await ctx.db
        .query('auditEvents')
        .filter((q) => q.eq(q.field('action'), 'booking_expired'))
        .collect(),
    }))
    expect(bookings.paidHeld).toMatchObject({
      status: 'held',
      paymentStatus: 'paid',
    })
    expect(bookings.unpaidHeld).toMatchObject({
      status: 'expired',
      paymentStatus: 'failed',
    })
    expect(bookings.pendingPayment).toMatchObject({
      status: 'expired',
      paymentStatus: 'failed',
    })
    expect(bookings.pendingPayment?.proofReviewDeadline).toBeUndefined()
    expect(bookings.reviewable).toMatchObject({
      status: 'pending_payment',
      paymentStatus: 'pending',
    })
    expect(bookings.confirmed).toMatchObject({
      status: 'confirmed',
      paymentStatus: 'pending',
    })
    expect(expiryAudits).toHaveLength(2)
    expect(expiryAudits.every((event) => event.actorId === undefined)).toBe(
      true,
    )
    expect(
      expiryAudits.every((event) => event.metadata?.actorKind === 'system'),
    ).toBe(true)
  })

  it('does not expire or overwrite a refunded hold', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedBooking(t, {
      status: 'held',
      paymentStatus: 'refunded',
      holdExpiresAt: Date.now() - 60_000,
    })

    const expiredCount = await t.mutation(
      internal.bookingsInternal.cleanupExpiredHolds,
      {},
    )

    expect(expiredCount).toBe(0)
    const booking = await t.run(async (ctx) => await ctx.db.get(bookingId))
    expect(booking).toMatchObject({
      status: 'held',
      paymentStatus: 'refunded',
    })
  })

  it('skips a malformed held booking instead of failing the whole sweep', async () => {
    const t = convexTest(schema, modules)
    const {
      bookingId: malformedId,
      customerId,
      hotelId,
      roomId,
    } = await seedBooking(t, { status: 'held', paymentStatus: 'pending' })
    const expiredId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('bookings', {
        userId: customerId,
        roomId,
        hotelId,
        checkIn: '2030-01-10',
        checkOut: '2030-01-11',
        status: 'held',
        paymentStatus: 'pending',
        holdExpiresAt: now - 60_000,
        pricePerNight: 10000,
        totalPrice: 10000,
        createdAt: now,
        updatedAt: now,
      })
    })

    const expiredCount = await t.mutation(
      internal.bookingsInternal.cleanupExpiredHolds,
      {},
    )

    expect(expiredCount).toBe(1)
    const statuses = await t.run(async (ctx) => ({
      expired: (await ctx.db.get(expiredId))?.status,
      malformed: (await ctx.db.get(malformedId))?.status,
    }))
    expect(statuses).toEqual({ expired: 'expired', malformed: 'held' })
  })

  it('rejects cancellation after payment or check-in', async () => {
    const t = convexTest(schema, modules)
    const {
      bookingId: paidBookingId,
      customerId,
      hotelId,
      roomId,
    } = await seedBooking(t, {
      status: 'confirmed',
      paymentStatus: 'paid',
    })
    const checkedInBookingId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('bookings', {
        userId: customerId,
        roomId,
        hotelId,
        checkIn: '2030-01-10',
        checkOut: '2030-01-11',
        status: 'checked_in',
        paymentStatus: 'pending',
        pricePerNight: 10000,
        totalPrice: 10000,
        createdAt: now,
        updatedAt: now,
      })
    })
    const customer = asUser(t, 'customer', 'customer@example.com')

    await expect(
      customer.mutation(api.bookings.cancelBooking, {
        bookingId: paidBookingId,
      }),
    ).rejects.toThrow('refund')
    await expect(
      customer.mutation(api.bookings.cancelBooking, {
        bookingId: checkedInBookingId,
      }),
    ).rejects.toThrow('checked-in')

    const statuses = await t.run(async (ctx) => ({
      paid: (await ctx.db.get(paidBookingId))?.status,
      checkedIn: (await ctx.db.get(checkedInBookingId))?.status,
    }))
    expect(statuses).toEqual({ paid: 'confirmed', checkedIn: 'checked_in' })
  })
})

describe('staff paid cancellation', () => {
  it('cancels a paid booking, keeps it paid, and flags the refund once', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedBooking(t, {
      status: 'confirmed',
      paymentStatus: 'paid',
    })
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('chapaPayments', {
        bookingId,
        txRef: 'bkg_paidcancel',
        bookingAmountCents: 10000,
        bookingCurrency: 'USD',
        chargedAmountMinor: 1400000,
        chargedCurrency: 'ETB',
        fxRateEtbPerUsd: 140,
        providerMode: 'test',
        status: 'paid',
        checkoutUrl: 'https://checkout.chapa.test/paidcancel',
        createdAt: now,
        updatedAt: now,
      })
    })
    const admin = asUser(t, 'admin', 'admin@example.com')

    await admin.mutation(api.bookings.cancelPaidBooking, {
      bookingId,
      reason: 'Room flooded',
    })

    const afterFirst = await t.run(async (ctx) => await ctx.db.get(bookingId))
    expect(afterFirst).toMatchObject({
      status: 'cancelled',
      paymentStatus: 'paid',
      refundStatus: 'required',
    })
    expect(typeof afterFirst?.refundRequiredAt).toBe('number')

    const payment = await t.run(
      async (ctx) => await ctx.db.query('chapaPayments').first(),
    )
    expect(payment).toMatchObject({ status: 'refund_required' })

    // A repeated staff click must not move the refund clock or double-log
    await admin.mutation(api.bookings.cancelPaidBooking, { bookingId })

    const afterSecond = await t.run(async (ctx) => await ctx.db.get(bookingId))
    expect(afterSecond?.refundRequiredAt).toBe(afterFirst?.refundRequiredAt)

    const auditEvents = await t.run(
      async (ctx) =>
        await ctx.db
          .query('auditEvents')
          .filter((q) =>
            q.eq(q.field('action'), 'booking_cancelled_refund_required'),
          )
          .collect(),
    )
    expect(auditEvents).toHaveLength(1)
  })

  it('refuses paid cancellation from a customer and on an unpaid booking', async () => {
    const t = convexTest(schema, modules)
    const { bookingId, customerId, hotelId, roomId } = await seedBooking(t, {
      status: 'confirmed',
      paymentStatus: 'paid',
    })
    const unpaidBookingId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('bookings', {
        userId: customerId,
        roomId,
        hotelId,
        checkIn: '2030-02-10',
        checkOut: '2030-02-11',
        status: 'confirmed',
        paymentStatus: 'pending',
        pricePerNight: 10000,
        totalPrice: 10000,
        createdAt: now,
        updatedAt: now,
      })
    })
    const customer = asUser(t, 'customer', 'customer@example.com')
    const admin = asUser(t, 'admin', 'admin@example.com')

    await expect(
      customer.mutation(api.bookings.cancelPaidBooking, { bookingId }),
    ).rejects.toThrow('staff')
    await expect(
      admin.mutation(api.bookings.cancelPaidBooking, {
        bookingId: unpaidBookingId,
      }),
    ).rejects.toThrow('refund-required')

    const statuses = await t.run(async (ctx) => ({
      paid: (await ctx.db.get(bookingId))?.status,
      unpaid: (await ctx.db.get(unpaidBookingId))?.status,
    }))
    expect(statuses).toEqual({ paid: 'confirmed', unpaid: 'confirmed' })
  })
})
