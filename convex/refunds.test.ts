/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

// Seeds one paid booking plus room-admin and cashier identities
async function seedRefundBooking(
  t: ReturnType<typeof convexTest>,
  method: 'manual' | 'chapa',
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const customerId = await ctx.db.insert('users', {
      clerkUserId: 'refund-customer',
      email: 'customer@example.com',
      role: 'customer',
      createdAt: now,
    })
    const adminId = await ctx.db.insert('users', {
      clerkUserId: 'refund-admin',
      email: 'admin@example.com',
      role: 'room_admin',
      createdAt: now,
    })
    const cashierId = await ctx.db.insert('users', {
      clerkUserId: 'refund-cashier',
      email: 'cashier@example.com',
      role: 'customer',
      createdAt: now,
    })
    const hotelId = await ctx.db.insert('hotels', {
      name: 'Refund Test Hotel',
      address: 'Bole Road',
      city: 'Addis Ababa',
      country: 'Ethiopia',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('hotelStaff', {
      userId: cashierId,
      hotelId,
      role: 'hotel_cashier',
      assignedAt: now,
      assignedBy: adminId,
    })
    const roomId = await ctx.db.insert('rooms', {
      hotelId,
      roomNumber: '501',
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
      status: 'cancelled',
      paymentStatus: 'paid',
      paymentMethod: method === 'chapa' ? 'chapa' : 'cash',
      refundStatus: 'required',
      refundMethod: method,
      refundReason: 'staff_cancelled',
      refundActionRequired: true,
      refundRequiredAt: now,
      pricePerNight: 10000,
      totalPrice: 10000,
      createdAt: now,
      updatedAt: now,
    })

    if (method === 'chapa') {
      await ctx.db.insert('chapaPayments', {
        bookingId,
        txRef: 'bkg_refund_test',
        chapaReference: 'AP-REFUND-TEST',
        bookingAmountCents: 10000,
        bookingCurrency: 'USD',
        chargedAmountMinor: 1400000,
        chargedCurrency: 'ETB',
        fxRateEtbPerUsd: 140,
        status: 'refund_required',
        checkoutUrl: 'https://checkout.chapa.test/refund',
        providerMode: 'test',
        createdAt: now,
        updatedAt: now,
      })
    }

    return { adminId, bookingId, cashierId, hotelId }
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('manual refunds', () => {
  it('lets a room admin complete a manual refund once', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedRefundBooking(t, 'manual')
    const admin = t.withIdentity({
      subject: 'refund-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })

    await admin.mutation(api.bookings.completeManualRefund, { bookingId })
    await admin.mutation(api.bookings.completeManualRefund, { bookingId })

    const result = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      audits: await ctx.db
        .query('auditEvents')
        .filter((q) => q.eq(q.field('action'), 'booking_refund_refunded'))
        .collect(),
    }))
    expect(result.booking).toMatchObject({
      paymentStatus: 'refunded',
      refundStatus: 'refunded',
      refundActionRequired: false,
    })
    expect(result.audits).toHaveLength(1)
  })

  it('keeps cashiers read-only', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedRefundBooking(t, 'manual')
    const cashier = t.withIdentity({
      subject: 'refund-cashier',
      email: 'cashier@example.com',
      emailVerified: true,
    })

    await expect(
      cashier.mutation(api.bookings.completeManualRefund, { bookingId }),
    ).rejects.toThrow('administrators')
  })
})

describe('paid no-show refund queue', () => {
  it('queues a confirmed paid arrival once after the Addis deadline', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-10T20:59:00.000Z'))
    const t = convexTest(schema, modules)
    const { bookingId } = await seedRefundBooking(t, 'manual')
    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, {
        status: 'confirmed',
        refundStatus: undefined,
        refundMethod: undefined,
        refundReason: undefined,
        refundActionRequired: undefined,
        refundRequiredAt: undefined,
      })
    })

    expect(
      await t.mutation(
        internal.bookingsInternal.createPaidNoShowRefundTasks,
        {},
      ),
    ).toBe(1)
    expect(
      await t.mutation(
        internal.bookingsInternal.createPaidNoShowRefundTasks,
        {},
      ),
    ).toBe(0)

    const booking = await t.run(async (ctx) => await ctx.db.get(bookingId))
    expect(booking).toMatchObject({
      status: 'cancelled',
      refundStatus: 'required',
      refundReason: 'no_show',
      refundActionRequired: true,
    })
  })
})
