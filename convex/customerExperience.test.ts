/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

const asUser = (
  t: ReturnType<typeof convexTest>,
  subject: string,
  email: string,
) => t.withIdentity({ subject, email, emailVerified: true })

const futureDate = (daysFromNow: number) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysFromNow)
  return date.toISOString().slice(0, 10)
}

describe('customer experience queries', () => {
  it('applies payment status filters before paginating hotel bookings', async () => {
    const t = convexTest(schema, modules)
    const { hotelId } = await t.run(async (ctx) => {
      const now = Date.now()
      const adminId = await ctx.db.insert('users', {
        clerkUserId: 'admin',
        email: 'admin@example.com',
        role: 'room_admin',
        createdAt: now,
      })
      const hotelId = await ctx.db.insert('hotels', {
        name: 'Atlas Hotel',
        address: '1 Main Street',
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

      for (let index = 0; index < 5; index += 1) {
        await ctx.db.insert('bookings', {
          roomId,
          hotelId,
          checkIn: futureDate(index + 2),
          checkOut: futureDate(index + 3),
          status: 'confirmed',
          paymentStatus: index < 3 ? 'paid' : undefined,
          pricePerNight: 10000,
          totalPrice: 10000,
          createdAt: now + index,
          updatedAt: now + index,
          updatedBy: adminId,
        })
      }

      return { hotelId }
    })
    const admin = asUser(t, 'admin', 'admin@example.com')

    const paidPage = await admin.query(api.bookings.getByHotel, {
      hotelId,
      paymentStatus: 'paid',
      paginationOpts: { numItems: 2, cursor: null },
    })
    expect(paidPage.page).toHaveLength(2)
    expect(
      paidPage.page.every((item) => item.booking.paymentStatus === 'paid'),
    ).toBe(true)
    expect(paidPage.isDone).toBe(false)

    const unknownPage = await admin.query(api.bookings.getByHotel, {
      hotelId,
      paymentStatus: 'unpaid_unknown',
      paginationOpts: { numItems: 10, cursor: null },
    })
    expect(unknownPage.page).toHaveLength(2)
    expect(
      unknownPage.page.every(
        (item) => item.booking.paymentStatus === undefined,
      ),
    ).toBe(true)
  })

  it('returns only operational, correctly sized, unblocked rooms in availability search', async () => {
    const t = convexTest(schema, modules)
    const checkIn = futureDate(10)
    const checkOut = futureDate(12)
    await t.run(async (ctx) => {
      const now = Date.now()
      const hotelId = await ctx.db.insert('hotels', {
        name: 'Rift Valley Retreat',
        address: 'Lake Road',
        city: 'Bishoftu',
        country: 'Ethiopia',
        category: 'Resort and Spa',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })
      const availableRoomId = await ctx.db.insert('rooms', {
        hotelId,
        roomNumber: '201',
        type: 'deluxe',
        basePrice: 12000,
        maxOccupancy: 3,
        operationalStatus: 'available',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })
      const blockedRoomId = await ctx.db.insert('rooms', {
        hotelId,
        roomNumber: '202',
        type: 'deluxe',
        basePrice: 9000,
        maxOccupancy: 3,
        operationalStatus: 'available',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('rooms', {
        hotelId,
        roomNumber: '203',
        type: 'standard',
        basePrice: 7000,
        maxOccupancy: 1,
        operationalStatus: 'available',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('bookings', {
        roomId: blockedRoomId,
        hotelId,
        checkIn,
        checkOut,
        status: 'confirmed',
        paymentStatus: 'paid',
        pricePerNight: 9000,
        totalPrice: 18000,
        createdAt: now,
        updatedAt: now,
      })

      expect(availableRoomId).toBeDefined()
    })

    const results = await t.query(api.hotels.searchAvailable, {
      destination: 'rift valley',
      checkIn,
      checkOut,
      guests: 2,
      city: 'bishoftu',
      category: 'Resort and Spa',
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      matchingRoomCount: 1,
      fromPrice: 12000,
      hotel: { name: 'Rift Valley Retreat' },
    })
  })

  it('returns an owned booking with trip and latest payment details', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        clerkUserId: 'traveler',
        email: 'traveler@example.com',
        role: 'customer',
        createdAt: now,
      })
      const hotelId = await ctx.db.insert('hotels', {
        name: 'City Lights Hotel',
        address: 'Bole Road',
        city: 'Addis Ababa',
        country: 'Ethiopia',
        location: { lat: 8.9806, lng: 38.7578 },
        tags: ['airport shuttle'],
        parkingIncluded: true,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })
      const roomId = await ctx.db.insert('rooms', {
        hotelId,
        roomNumber: '501',
        type: 'suite',
        basePrice: 25000,
        maxOccupancy: 4,
        operationalStatus: 'available',
        amenities: ['Wi-Fi'],
        bedOptions: '1 King Bed',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })
      const bookingId = await ctx.db.insert('bookings', {
        userId,
        roomId,
        hotelId,
        checkIn: futureDate(20),
        checkOut: futureDate(22),
        status: 'pending_payment',
        holdExpiresAt: now + 15 * 60 * 1000,
        paymentStatus: 'pending',
        pricePerNight: 25000,
        totalPrice: 50000,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('chapaPayments', {
        bookingId,
        txRef: 'trip-command-center-test',
        bookingAmountCents: 50000,
        bookingCurrency: 'USD',
        chargedAmountMinor: 7000000,
        chargedCurrency: 'ETB',
        fxRateEtbPerUsd: 140,
        status: 'initialized',
        checkoutUrl: 'https://checkout.example.com/test',
        createdAt: now,
        updatedAt: now,
      })
      return { bookingId }
    })

    const traveler = asUser(t, 'traveler', 'traveler@example.com')
    const detail = await traveler.query(api.bookings.getEnriched, { bookingId })

    expect(detail).toMatchObject({
      booking: { status: 'pending_payment', paymentStatus: 'pending' },
      room: { roomNumber: '501', maxOccupancy: 4, bedOptions: '1 King Bed' },
      hotel: {
        name: 'City Lights Hotel',
        parkingIncluded: true,
        location: { lat: 8.9806, lng: 38.7578 },
      },
      payment: { txRef: 'trip-command-center-test', status: 'initialized' },
    })
  })
})
