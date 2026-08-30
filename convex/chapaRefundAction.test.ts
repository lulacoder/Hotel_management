/// <reference types="vite/client" />
// @vitest-environment node
import * as crypto from 'node:crypto'

import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

// Seeds a provider-classified refund task ready for an administrator click
async function seedChapaRefund(
  t: ReturnType<typeof convexTest>,
  options: { chapaReference?: string } = {},
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const adminId = await ctx.db.insert('users', {
      clerkUserId: 'chapa-refund-admin',
      email: 'admin@example.com',
      role: 'room_admin',
      createdAt: now,
    })
    const guestId = await ctx.db.insert('users', {
      clerkUserId: 'chapa-refund-guest',
      email: 'guest@example.com',
      role: 'customer',
      createdAt: now,
    })
    const hotelId = await ctx.db.insert('hotels', {
      name: 'Chapa Refund Hotel',
      address: 'Bole Road',
      city: 'Addis Ababa',
      country: 'Ethiopia',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('hotelStaff', {
      userId: adminId,
      hotelId,
      role: 'hotel_admin',
      assignedAt: now,
      assignedBy: adminId,
    })
    const roomId = await ctx.db.insert('rooms', {
      hotelId,
      roomNumber: '601',
      type: 'standard',
      basePrice: 10000,
      maxOccupancy: 2,
      operationalStatus: 'available',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
    const bookingId = await ctx.db.insert('bookings', {
      userId: guestId,
      roomId,
      hotelId,
      checkIn: '2030-01-10',
      checkOut: '2030-01-11',
      status: 'cancelled',
      paymentStatus: 'paid',
      paymentMethod: 'chapa',
      refundStatus: 'required',
      refundMethod: 'chapa',
      refundReason: 'staff_cancelled',
      refundActionRequired: true,
      refundRequiredAt: now,
      pricePerNight: 10000,
      totalPrice: 10000,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('chapaPayments', {
      bookingId,
      txRef: 'bkg_refund_action',
      chapaReference:
        'chapaReference' in options
          ? options.chapaReference
          : 'AP-REFUND-ACTION',
      bookingAmountCents: 10000,
      bookingCurrency: 'USD',
      chargedAmountMinor: 1400000,
      chargedCurrency: 'ETB',
      fxRateEtbPerUsd: 140,
      status: 'refund_required',
      checkoutUrl: 'https://checkout.chapa.test/refund-action',
      providerMode: 'test',
      createdAt: now,
      updatedAt: now,
    })
    return { adminId, bookingId, guestId }
  })
}

const WEBHOOK_SECRET = 'chapa-webhook-secret'

// Signs a webhook body exactly as Chapa does so the action accepts it
function signWebhook(body: string) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
}

beforeEach(() => {
  vi.stubEnv('CHAPA_SECRET_KEY', 'CHASECK_TEST-secret')
  vi.stubEnv('CHAPA_WEBHOOK_SECRET', WEBHOOK_SECRET)
  vi.stubEnv('CHAPA_EXPECTED_MODE', 'test')
  // The acceptance path queues an administrator email, so its mail settings must resolve
  vi.stubEnv('WEB_APP_URL', 'https://app.example.com')
  vi.stubEnv('NOTIFICATION_FROM_EMAIL', 'Bookings <bookings@example.com>')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Chapa full refunds', () => {
  it('stores ref_id and refunds the original ETB charge', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedChapaRefund(t)
    const admin = t.withIdentity({
      subject: 'chapa-refund-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          data: { ref_id: 'refund-ref-id', status: 'processing' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await admin.action(api.chapaActions.initiateRefund, {
      bookingId,
    })
    expect(result).toMatchObject({ success: true, state: 'processing' })
    const [, request] = fetchMock.mock.calls[0]
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/refund/AP-REFUND-ACTION',
    )
    expect(String(request.body)).toContain('amount=14000.00')

    const payment = await t.run(async (ctx) =>
      ctx.db.query('chapaPayments').first(),
    )
    expect(payment).toMatchObject({
      status: 'refund_initiated',
      refundRefId: 'refund-ref-id',
      refundAmountMinor: 1400000,
    })
  })

  it('keeps the guest silent and queues the administrator email on acceptance', async () => {
    const t = convexTest(schema, modules)
    const { adminId, bookingId, guestId } = await seedChapaRefund(t)
    const admin = t.withIdentity({
      subject: 'chapa-refund-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'success',
            data: { ref_id: 'refund-ref-id', status: 'processing' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await admin.action(api.chapaActions.initiateRefund, { bookingId })

    const { guestNotifications, scheduled } = await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      return {
        guestNotifications: notifications.filter(
          (entry) => entry.userId === guestId,
        ),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
      }
    })

    // An in-flight refund is an operational step, so the guest hears nothing yet
    expect(guestNotifications).toHaveLength(0)
    const emailJob = scheduled.find((job) =>
      job.name.includes('sendRefundAcceptedEmails'),
    )
    expect(emailJob?.args[0]).toMatchObject({
      bookingId,
      refundRefId: 'refund-ref-id',
      refundAmountMinor: 1400000,
      requestedBy: adminId,
    })
  })

  it('does not email administrators when Chapa rejects the refund', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedChapaRefund(t)
    const admin = t.withIdentity({
      subject: 'chapa-refund-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'failed',
            message: 'Refund not permitted',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const result = await admin.action(api.chapaActions.initiateRefund, {
      bookingId,
    })
    expect(result.success).toBe(false)

    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    )
    expect(
      scheduled.some((job) => job.name.includes('sendRefundAcceptedEmails')),
    ).toBe(false)
  })

  it('blocks a second POST after an ambiguous transport failure', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedChapaRefund(t)
    const admin = t.withIdentity({
      subject: 'chapa-refund-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })
    const fetchMock = vi.fn().mockRejectedValue(new Error('socket timeout'))
    vi.stubGlobal('fetch', fetchMock)

    const first = await admin.action(api.chapaActions.initiateRefund, {
      bookingId,
    })
    const second = await admin.action(api.chapaActions.initiateRefund, {
      bookingId,
    })

    expect(first.state).toBe('verification_required')
    expect(second.state).toBe('verification_required')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refuses to call Chapa when the payment has no Chapa reference', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await seedChapaRefund(t, {
      chapaReference: undefined,
    })
    const admin = t.withIdentity({
      subject: 'chapa-refund-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      admin.action(api.chapaActions.initiateRefund, { bookingId }),
    ).rejects.toThrow('no Chapa reference')

    // The task must stay open and unlocked so staff can still refund by hand
    const { booking, payment } = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      payment: await ctx.db.query('chapaPayments').first(),
    }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(booking).toMatchObject({
      refundStatus: 'required',
      refundActionRequired: true,
    })
    expect(payment).toMatchObject({ status: 'refund_required' })
  })

  it('tells the guest and staff when the polling cron confirms a refund', async () => {
    const t = convexTest(schema, modules)
    const { bookingId, guestId } = await seedChapaRefund(t)
    const admin = t.withIdentity({
      subject: 'chapa-refund-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })
    // Accept the refund without a terminal status so only the cron can settle it
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'success',
            data: { ref_id: 'refund-ref-id', status: 'processing' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    await admin.action(api.chapaActions.initiateRefund, { bookingId })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'success',
            data: {
              ref_id: 'refund-ref-id',
              status: 'refunded',
              amount: '14000.00',
              currency: 'ETB',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const verified = await t.action(internal.chapaActions.verifyPendingRefunds)
    expect(verified).toBe(1)

    const { booking, guestTypes } = await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      return {
        booking: await ctx.db.get(bookingId),
        guestTypes: notifications
          .filter((entry) => entry.userId === guestId)
          .map((entry) => entry.type),
      }
    })

    expect(booking).toMatchObject({
      refundStatus: 'refunded',
      paymentStatus: 'refunded',
      refundActionRequired: false,
    })
    expect(guestTypes).toContain('booking_refunded')
  })

  it('flags staff when the polling cron finds a reversal', async () => {
    const t = convexTest(schema, modules)
    const { adminId, bookingId } = await seedChapaRefund(t)
    const admin = t.withIdentity({
      subject: 'chapa-refund-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'success',
            data: { ref_id: 'refund-ref-id', status: 'processing' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    await admin.action(api.chapaActions.initiateRefund, { bookingId })

    // A reversal means the guest was never paid, so the task must reopen
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'success',
            data: { ref_id: 'refund-ref-id', status: 'reversed' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    await t.action(internal.chapaActions.verifyPendingRefunds)

    const { booking, staffTypes } = await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      return {
        booking: await ctx.db.get(bookingId),
        staffTypes: notifications
          .filter((entry) => entry.userId === adminId)
          .map((entry) => entry.type),
      }
    })

    expect(booking).toMatchObject({
      refundStatus: 'reversed',
      paymentStatus: 'paid',
      refundActionRequired: true,
    })
    expect(staffTypes).toContain('booking_refund_reversed')
  })

  it('settles the booking from a refund.success webhook', async () => {
    const t = convexTest(schema, modules)
    const { bookingId, guestId } = await seedChapaRefund(t)
    const admin = t.withIdentity({
      subject: 'chapa-refund-admin',
      email: 'admin@example.com',
      emailVerified: true,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'success',
            data: { ref_id: 'refund-ref-id', status: 'processing' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    await admin.action(api.chapaActions.initiateRefund, { bookingId })

    // Chapa sends refund.success, not charge.refunded, and reports the charge as
    // refunded only when the transaction is re-verified
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'success',
            data: {
              status: 'refunded',
              reference: 'AP-REFUND-ACTION',
              tx_ref: 'bkg_refund_action',
              mode: 'test',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const body = JSON.stringify({
      event: 'refund.success',
      status: 'success',
      tx_ref: 'bkg_refund_action',
      reference: 'AP-REFUND-ACTION',
    })
    const response = await t.action(internal.chapaActions.processWebhook, {
      body,
      xChapaSignature: signWebhook(body),
    })
    expect(response).toMatchObject({ statusCode: 200 })

    const { booking, payment, guestTypes } = await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      return {
        booking: await ctx.db.get(bookingId),
        payment: await ctx.db.query('chapaPayments').first(),
        guestTypes: notifications
          .filter((entry) => entry.userId === guestId)
          .map((entry) => entry.type),
      }
    })

    expect(payment).toMatchObject({ status: 'refunded' })
    expect(booking).toMatchObject({
      refundStatus: 'refunded',
      paymentStatus: 'refunded',
      refundActionRequired: false,
    })
    expect(guestTypes).toContain('booking_refunded')
  })

  it('repairs a booking left processing after its payment settled', async () => {
    const t = convexTest(schema, modules)
    const { bookingId, guestId } = await seedChapaRefund(t)

    // Recreate the drift a missed booking projection leaves behind
    await t.run(async (ctx) => {
      const payment = await ctx.db.query('chapaPayments').first()
      const booking = await ctx.db.get(bookingId)
      if (!payment || !booking) throw new Error('seed failed')
      await ctx.db.patch(payment._id, {
        status: 'refunded',
        refundReference: 'refund_drift',
        refundRefId: 'refund-ref-id',
        refundAmountMinor: 1400000,
      })
      await ctx.db.patch(booking._id, {
        refundStatus: 'processing',
        refundStartedAt: Date.now(),
        refundLastError: 'A stale error from an earlier attempt.',
      })
    })

    const repaired = await t.mutation(
      internal.chapaInternal.settleDriftedRefunds,
      {},
    )
    expect(repaired).toBe(1)

    const { booking, guestTypes } = await t.run(async (ctx) => {
      const notifications = await ctx.db.query('notifications').collect()
      return {
        booking: await ctx.db.get(bookingId),
        guestTypes: notifications
          .filter((entry) => entry.userId === guestId)
          .map((entry) => entry.type),
      }
    })

    expect(booking).toMatchObject({
      refundStatus: 'refunded',
      paymentStatus: 'refunded',
      refundActionRequired: false,
    })
    expect(booking?.refundLastError).toBeUndefined()
    expect(guestTypes).toContain('booking_refunded')
  })
})
