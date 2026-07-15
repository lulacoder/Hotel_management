/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { internal } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

async function seedHotel(
  t: ReturnType<typeof convexTest>,
  name: string,
): Promise<Id<'hotels'>> {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('hotels', {
      name,
      address: '1 Main Street',
      city: 'Addis Ababa',
      country: 'Ethiopia',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function seedUser(
  t: ReturnType<typeof convexTest>,
  clerkUserId: string,
  email: string,
  role: 'customer' | 'room_admin' = 'customer',
): Promise<Id<'users'>> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('users', {
      clerkUserId,
      email,
      role,
      createdAt: Date.now(),
    })
  })
}

function asUser(
  t: ReturnType<typeof convexTest>,
  subject: string,
  email: string,
) {
  return t.withIdentity({ subject, email, emailVerified: true })
}

describe('hotel staff invitations', () => {
  it('allows room admins to invite either hotel role', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'room-admin', 'owner@example.com', 'room_admin')
    const hotelId = await seedHotel(t, 'Atlas Hotel')
    const roomAdmin = asUser(t, 'room-admin', 'owner@example.com')

    const invitation = await roomAdmin.mutation(
      internal.staffInvitations.createPending,
      {
        email: 'New.Admin@Example.com',
        hotelId,
        role: 'hotel_admin',
        tokenHash: 'first-hash',
      },
    )

    expect(invitation).toMatchObject({
      email: 'new.admin@example.com',
      hotelName: 'Atlas Hotel',
      role: 'hotel_admin',
    })
  })

  it('limits hotel admins to cashier invitations for their own hotel', async () => {
    const t = convexTest(schema, modules)
    const roomAdminId = await seedUser(
      t,
      'room-admin',
      'owner@example.com',
      'room_admin',
    )
    const hotelAdminId = await seedUser(t, 'hotel-admin', 'manager@example.com')
    const ownHotelId = await seedHotel(t, 'Own Hotel')
    const otherHotelId = await seedHotel(t, 'Other Hotel')
    await t.run(async (ctx) => {
      await ctx.db.insert('hotelStaff', {
        userId: hotelAdminId,
        hotelId: ownHotelId,
        role: 'hotel_admin',
        assignedAt: Date.now(),
        assignedBy: roomAdminId,
      })
    })
    const hotelAdmin = asUser(t, 'hotel-admin', 'manager@example.com')

    await expect(
      hotelAdmin.mutation(internal.staffInvitations.createPending, {
        email: 'admin@example.com',
        hotelId: ownHotelId,
        role: 'hotel_admin',
        tokenHash: 'admin-hash',
      }),
    ).rejects.toThrow('permission')
    await expect(
      hotelAdmin.mutation(internal.staffInvitations.createPending, {
        email: 'cashier@example.com',
        hotelId: otherHotelId,
        role: 'hotel_cashier',
        tokenHash: 'other-hash',
      }),
    ).rejects.toThrow('permission')

    const invitation = await hotelAdmin.mutation(
      internal.staffInvitations.createPending,
      {
        email: 'cashier@example.com',
        hotelId: ownHotelId,
        role: 'hotel_cashier',
        tokenHash: 'cashier-hash',
      },
    )
    expect(invitation.role).toBe('hotel_cashier')
  })

  it('accepts only the verified recipient and creates one atomic assignment', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'room-admin', 'owner@example.com', 'room_admin')
    const recipientId = await seedUser(t, 'recipient', 'recipient@example.com')
    const hotelId = await seedHotel(t, 'Harbor Hotel')
    const roomAdmin = asUser(t, 'room-admin', 'owner@example.com')
    const recipient = asUser(t, 'recipient', 'recipient@example.com')
    const wrongUser = asUser(t, 'recipient', 'wrong@example.com')
    const invitation = await roomAdmin.mutation(
      internal.staffInvitations.createPending,
      {
        email: 'recipient@example.com',
        hotelId,
        role: 'hotel_cashier',
        tokenHash: 'secure-hash',
      },
    )

    await expect(
      wrongUser.mutation(internal.staffInvitations.acceptHashed, {
        invitationId: invitation.invitationId,
        tokenHash: 'secure-hash',
      }),
    ).rejects.toThrow('sent to')

    const assignmentId = await recipient.mutation(
      internal.staffInvitations.acceptHashed,
      {
        invitationId: invitation.invitationId,
        tokenHash: 'secure-hash',
      },
    )
    const result = await t.run(async (ctx) => ({
      assignment: await ctx.db.get(assignmentId),
      invitation: await ctx.db.get(invitation.invitationId),
    }))

    expect(result.assignment).toMatchObject({
      userId: recipientId,
      hotelId,
      role: 'hotel_cashier',
    })
    expect(result.invitation).toMatchObject({
      status: 'accepted',
      acceptedBy: recipientId,
    })
  })

  it('rejects expired, replaced, and already-assigned acceptance attempts', async () => {
    const t = convexTest(schema, modules)
    const roomAdminId = await seedUser(
      t,
      'room-admin',
      'owner@example.com',
      'room_admin',
    )
    const recipientId = await seedUser(t, 'recipient', 'recipient@example.com')
    const hotelId = await seedHotel(t, 'City Hotel')
    const otherHotelId = await seedHotel(t, 'Existing Hotel')
    const roomAdmin = asUser(t, 'room-admin', 'owner@example.com')
    const recipient = asUser(t, 'recipient', 'recipient@example.com')
    const invitation = await roomAdmin.mutation(
      internal.staffInvitations.createPending,
      {
        email: 'recipient@example.com',
        hotelId,
        role: 'hotel_cashier',
        tokenHash: 'current-hash',
      },
    )

    await expect(
      recipient.mutation(internal.staffInvitations.acceptHashed, {
        invitationId: invitation.invitationId,
        tokenHash: 'old-hash',
      }),
    ).rejects.toThrow('invalid or has been replaced')

    await t.run(async (ctx) => {
      await ctx.db.patch(invitation.invitationId, { expiresAt: Date.now() - 1 })
    })
    await expect(
      recipient.mutation(internal.staffInvitations.acceptHashed, {
        invitationId: invitation.invitationId,
        tokenHash: 'current-hash',
      }),
    ).rejects.toThrow('expired')

    await t.run(async (ctx) => {
      await ctx.db.patch(invitation.invitationId, {
        expiresAt: Date.now() + 60_000,
      })
      await ctx.db.insert('hotelStaff', {
        userId: recipientId,
        hotelId: otherHotelId,
        role: 'hotel_cashier',
        assignedAt: Date.now(),
        assignedBy: roomAdminId,
      })
    })
    await expect(
      recipient.mutation(internal.staffInvitations.acceptHashed, {
        invitationId: invitation.invitationId,
        tokenHash: 'current-hash',
      }),
    ).rejects.toThrow('already belong')
  })

  it('rotates links on resend and preserves failed delivery for recovery', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'room-admin', 'owner@example.com', 'room_admin')
    const hotelId = await seedHotel(t, 'Garden Hotel')
    const roomAdmin = asUser(t, 'room-admin', 'owner@example.com')
    const invitation = await roomAdmin.mutation(
      internal.staffInvitations.createPending,
      {
        email: 'cashier@example.com',
        hotelId,
        role: 'hotel_cashier',
        tokenHash: 'first-hash',
      },
    )

    await roomAdmin.mutation(internal.staffInvitations.rotateForResend, {
      invitationId: invitation.invitationId,
      tokenHash: 'second-hash',
    })
    await roomAdmin.mutation(internal.staffInvitations.markDelivery, {
      invitationId: invitation.invitationId,
      tokenHash: 'second-hash',
      deliveryStatus: 'failed',
    })

    const stored = await t.run(async (ctx) =>
      ctx.db.get(invitation.invitationId),
    )
    expect(stored).toMatchObject({
      tokenHash: 'second-hash',
      resendCount: 1,
      status: 'pending',
      deliveryStatus: 'failed',
    })
  })
})
