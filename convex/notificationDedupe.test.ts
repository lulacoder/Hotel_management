/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

// Seeds one hotel with two staff members and a booking to fan out alerts about
async function seedStaffedBooking(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const adminId = await ctx.db.insert('users', {
      clerkUserId: 'dedupe-admin',
      email: 'dedupe-admin@example.com',
      role: 'customer',
      createdAt: now,
    })
    const cashierId = await ctx.db.insert('users', {
      clerkUserId: 'dedupe-cashier',
      email: 'dedupe-cashier@example.com',
      role: 'customer',
      createdAt: now,
    })
    const hotelId = await ctx.db.insert('hotels', {
      name: 'Dedupe Hotel',
      address: 'Bole Road',
      city: 'Addis Ababa',
      country: 'Ethiopia',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
    for (const [userId, role] of [
      [adminId, 'hotel_admin'] as const,
      [cashierId, 'hotel_cashier'] as const,
    ]) {
      await ctx.db.insert('hotelStaff', {
        userId,
        hotelId,
        role,
        assignedAt: now,
        assignedBy: adminId,
      })
    }
    const roomId = await ctx.db.insert('rooms', {
      hotelId,
      roomNumber: '701',
      type: 'standard',
      basePrice: 10000,
      maxOccupancy: 2,
      operationalStatus: 'available',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
    const bookingId = await ctx.db.insert('bookings', {
      roomId,
      hotelId,
      checkIn: '2030-02-10',
      checkOut: '2030-02-11',
      status: 'cancelled',
      paymentStatus: 'paid',
      pricePerNight: 10000,
      totalPrice: 10000,
      createdAt: now,
      updatedAt: now,
    })
    return { adminId, bookingId, cashierId, hotelId }
  })
}

describe('staff notification fan-out', () => {
  it('refreshes an unread alert instead of repeating it', async () => {
    const t = convexTest(schema, modules)
    const { adminId, bookingId, cashierId, hotelId } =
      await seedStaffedBooking(t)

    await t.mutation(internal.notifications.notifyHotelStaff, {
      hotelId,
      type: 'booking_refund_required',
      bookingId,
      message: 'First attempt',
    })
    await t.mutation(internal.notifications.notifyHotelStaff, {
      hotelId,
      type: 'booking_refund_required',
      bookingId,
      message: 'Second attempt',
    })

    const notifications = await t.run(async (ctx) =>
      ctx.db.query('notifications').collect(),
    )
    expect(notifications).toHaveLength(2)
    expect(notifications.map((entry) => entry.message)).toEqual([
      'Second attempt',
      'Second attempt',
    ])
    expect(
      notifications.filter(
        (entry) => entry.userId === adminId || entry.userId === cashierId,
      ),
    ).toHaveLength(2)
  })

  it('raises a fresh alert once the staff member has read the last one', async () => {
    const t = convexTest(schema, modules)
    const { adminId, bookingId, hotelId } = await seedStaffedBooking(t)

    await t.mutation(internal.notifications.notifyHotelStaff, {
      hotelId,
      type: 'booking_refund_required',
      bookingId,
      message: 'First attempt',
    })

    // A read alert is already dealt with, so a later event must not hide inside it
    await t.run(async (ctx) => {
      const existing = await ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('userId'), adminId))
        .unique()
      await ctx.db.patch(existing!._id, { isRead: true })
    })

    await t.mutation(internal.notifications.notifyHotelStaff, {
      hotelId,
      type: 'booking_refund_required',
      bookingId,
      message: 'Second attempt',
    })

    const adminNotifications = await t.run(async (ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('userId'), adminId))
        .collect(),
    )
    expect(adminNotifications).toHaveLength(2)
    expect(adminNotifications.filter((entry) => entry.isRead)).toHaveLength(1)
  })

  it('keeps a different alert type on the same booking separate', async () => {
    const t = convexTest(schema, modules)
    const { bookingId, hotelId } = await seedStaffedBooking(t)

    await t.mutation(internal.notifications.notifyHotelStaff, {
      hotelId,
      type: 'booking_refund_required',
      bookingId,
      message: 'Refund required',
    })
    await t.mutation(internal.notifications.notifyHotelStaff, {
      hotelId,
      type: 'booking_refund_reversed',
      bookingId,
      message: 'Refund reversed',
    })

    const notifications = await t.run(async (ctx) =>
      ctx.db.query('notifications').collect(),
    )
    expect(notifications).toHaveLength(4)
  })
})
