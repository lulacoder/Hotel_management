/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'
import { transitionBooking } from './lib/bookingTransitions'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

interface SeededBooking {
  adminId: Id<'users'>
  bookingId: Id<'bookings'>
  customerId: Id<'users'>
  hotelId: Id<'hotels'>
  roomId: Id<'rooms'>
}

// Seeds one booking plus the users and hotel records used by lifecycle mutations.
async function seedBooking(
  t: ReturnType<typeof convexTest>,
  status: 'held' | 'pending_payment' | 'confirmed',
  paymentStatus: 'pending' | 'paid' = 'pending',
): Promise<SeededBooking> {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const adminId = await ctx.db.insert('users', {
      clerkUserId: 'lifecycle-admin',
      email: 'admin@example.com',
      role: 'room_admin',
      createdAt: now,
    })
    const customerId = await ctx.db.insert('users', {
      clerkUserId: 'lifecycle-customer',
      email: 'customer@example.com',
      role: 'customer',
      createdAt: now,
    })
    const hotelId = await ctx.db.insert('hotels', {
      name: 'Lifecycle Hotel',
      address: 'Test Street',
      city: 'Addis Ababa',
      country: 'Ethiopia',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
    const roomId = await ctx.db.insert('rooms', {
      hotelId,
      roomNumber: '901',
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
      checkIn: '2030-03-10',
      checkOut: '2030-03-11',
      status,
      paymentStatus,
      holdExpiresAt: status === 'held' ? now + 15 * 60 * 1000 : undefined,
      proofReviewDeadline:
        status === 'pending_payment' ? now + 24 * 60 * 60 * 1000 : undefined,
      pricePerNight: 10000,
      totalPrice: 10000,
      createdAt: now,
      updatedAt: now,
    })

    return { adminId, bookingId, customerId, hotelId, roomId }
  })
}

// Adds hotel-scoped cashier access and returns its authenticated test client.
async function addCashier(
  t: ReturnType<typeof convexTest>,
  hotelId: Id<'hotels'>,
  assignedBy: Id<'users'>,
) {
  await t.run(async (ctx) => {
    const now = Date.now()
    const cashierId = await ctx.db.insert('users', {
      clerkUserId: 'lifecycle-cashier',
      email: 'cashier@example.com',
      role: 'customer',
      createdAt: now,
    })
    await ctx.db.insert('hotelStaff', {
      userId: cashierId,
      hotelId,
      role: 'hotel_cashier',
      assignedAt: now,
      assignedBy,
    })
  })

  return t.withIdentity({
    subject: 'lifecycle-cashier',
    email: 'cashier@example.com',
    emailVerified: true,
  })
}

describe('centralized booking transitions', () => {
  it('rejects payment-proof transitions that omit the hold-expiry key', async () => {
    const t = convexTest(schema, modules)
    const { bookingId, customerId } = await seedBooking(t, 'held')

    await expect(
      t.run(async (ctx) => {
        const booking = await ctx.db.get(bookingId)
        if (!booking) throw new Error('Seeded booking was not found.')

        await transitionBooking(ctx, {
          booking,
          event: 'payment_proof_submitted',
          to: 'pending_payment',
          actor: { kind: 'user', userId: customerId },
          changes: { paymentStatus: 'pending' },
        })
      }),
    ).rejects.toThrow('must clear the hold')

    const booking = await t.run(async (ctx) => await ctx.db.get(bookingId))
    expect(booking).toMatchObject({
      status: 'held',
      paymentStatus: 'pending',
      holdExpiresAt: expect.any(Number),
    })
  })

  it('refuses to leave payment review without releasing the review deadline', async () => {
    const t = convexTest(schema, modules)
    const { bookingId, customerId } = await seedBooking(t, 'pending_payment')

    await expect(
      t.run(async (ctx) => {
        const booking = await ctx.db.get(bookingId)
        if (!booking) throw new Error('Seeded booking was not found.')

        await transitionBooking(ctx, {
          booking,
          event: 'booking_cancelled',
          to: 'cancelled',
          actor: { kind: 'user', userId: customerId },
        })
      }),
    ).rejects.toThrow('review deadline')

    const booking = await t.run(async (ctx) => await ctx.db.get(bookingId))
    expect(booking).toMatchObject({
      status: 'pending_payment',
      proofReviewDeadline: expect.any(Number),
    })
  })

  it('allows staff check-in and check-out but not cancellation through updateStatus', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedBooking(t, 'confirmed', 'paid')
    const admin = t.withIdentity({
      subject: 'lifecycle-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })

    await expect(
      admin.mutation(api.bookings.updateStatus, {
        bookingId,
        nextStatus: 'cancelled',
      }),
    ).rejects.toThrow('staff_status_updated')

    await admin.mutation(api.bookings.updateStatus, {
      bookingId,
      nextStatus: 'checked_in',
    })
    await admin.mutation(api.bookings.updateStatus, {
      bookingId,
      nextStatus: 'checked_out',
    })

    const result = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      audits: await ctx.db
        .query('auditEvents')
        .withIndex('by_target', (q) =>
          q.eq('targetType', 'booking').eq('targetId', bookingId),
        )
        .collect(),
    }))
    expect(result.booking?.status).toBe('checked_out')
    expect(result.audits.map((event) => event.action)).toEqual([
      'booking_status_updated',
      'booking_status_updated',
    ])
  })

  it(
    'confirms a bank payment through the shared transition helper',
    { timeout: 20000 },
    async () => {
      const t = convexTest(schema, modules)
      const { adminId, bookingId, hotelId } = await seedBooking(
        t,
        'pending_payment',
      )
      const cashier = await addCashier(t, hotelId, adminId)

      await cashier.mutation(api.bookings.verifyPayment, { bookingId })

      const result = await t.run(async (ctx) => ({
        booking: await ctx.db.get(bookingId),
        audits: await ctx.db
          .query('auditEvents')
          .withIndex('by_target', (q) =>
            q.eq('targetType', 'booking').eq('targetId', bookingId),
          )
          .collect(),
      }))
      expect(result.booking).toMatchObject({
        status: 'confirmed',
        paymentStatus: 'paid',
      })
      expect(result.booking?.proofReviewDeadline).toBeUndefined()
      expect(result.audits).toHaveLength(1)
      expect(result.audits[0]).toMatchObject({
        action: 'booking_payment_verified',
        actorId: expect.any(String),
      })
    },
  )

  it('rejects a bank payment through the shared transition helper', async () => {
    const t = convexTest(schema, modules)
    const { adminId, bookingId, hotelId } = await seedBooking(
      t,
      'pending_payment',
    )
    const cashier = await addCashier(t, hotelId, adminId)

    await cashier.mutation(api.bookings.rejectPayment, { bookingId })

    const result = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      audits: await ctx.db
        .query('auditEvents')
        .withIndex('by_target', (q) =>
          q.eq('targetType', 'booking').eq('targetId', bookingId),
        )
        .collect(),
    }))
    expect(result.booking).toMatchObject({
      status: 'cancelled',
      paymentStatus: 'failed',
    })
    expect(result.booking?.proofReviewDeadline).toBeUndefined()
    expect(result.audits).toHaveLength(1)
    expect(result.audits[0].action).toBe('booking_payment_rejected')
  })

  it('outsources through the shared transition helper', async () => {
    const t = convexTest(schema, modules)
    const { adminId, bookingId, hotelId } = await seedBooking(t, 'confirmed')
    const cashier = await addCashier(t, hotelId, adminId)
    const destinationHotelId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('hotels', {
        name: 'Destination Hotel',
        address: 'Other Street',
        city: 'Addis Ababa',
        country: 'Ethiopia',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })
    })

    await cashier.mutation(api.bookings.outsourceBooking, {
      bookingId,
      destinationHotelId,
    })

    const result = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      audits: await ctx.db
        .query('auditEvents')
        .withIndex('by_target', (q) =>
          q.eq('targetType', 'booking').eq('targetId', bookingId),
        )
        .collect(),
    }))
    expect(result.booking).toMatchObject({
      status: 'outsourced',
      outsourcedToHotelId: destinationHotelId,
    })
    expect(result.audits).toHaveLength(1)
    expect(result.audits[0].action).toBe('booking_outsourced')
  })

  it('attributes Chapa confirmation to the provider and stays idempotent', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedBooking(t, 'held')

    const first = await t.mutation(internal.bookings.confirmChapaPayment, {
      bookingId,
      chapaReference: 'chapa-confirmed-reference',
    })
    const second = await t.mutation(internal.bookings.confirmChapaPayment, {
      bookingId,
      chapaReference: 'chapa-confirmed-reference',
    })

    const result = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      audits: await ctx.db
        .query('auditEvents')
        .withIndex('by_target', (q) =>
          q.eq('targetType', 'booking').eq('targetId', bookingId),
        )
        .collect(),
    }))
    expect(first).toBe('confirmed')
    expect(second).toBe('already_confirmed')
    expect(result.booking).toMatchObject({
      status: 'confirmed',
      paymentStatus: 'paid',
      transactionId: 'chapa-confirmed-reference',
    })
    expect(result.audits).toHaveLength(1)
    expect(result.audits[0].actorId).toBeUndefined()
    expect(result.audits[0].metadata).toMatchObject({
      actorKind: 'provider',
      provider: 'chapa',
    })
  })
})
