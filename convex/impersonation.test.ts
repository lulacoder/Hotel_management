/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { api, internal } from './_generated/api'
import { getCurrentUser, getRealAdminUser, requireCustomer } from './lib/auth'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

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

async function seedHotel(
  t: ReturnType<typeof convexTest>,
  name: string,
): Promise<Id<'hotels'>> {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('hotels', {
      name,
      address: 'Bole Road',
      city: 'Addis Ababa',
      country: 'Ethiopia',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function assignStaff(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  hotelId: Id<'hotels'>,
  role: 'hotel_admin' | 'hotel_cashier',
  assignedBy: Id<'users'>,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('hotelStaff', {
      userId,
      hotelId,
      role,
      assignedAt: Date.now(),
      assignedBy,
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

describe('Option B: Convex-Native Act-As Delegation', () => {
  it('allows room_admin to impersonate a customer and executes actions in target user context', async () => {
    const t = convexTest(schema, modules)
    const adminId = await seedUser(t, 'admin_1', 'admin@example.com', 'room_admin')
    const customerId = await seedUser(t, 'cust_1', 'customer@example.com', 'customer')

    const adminClient = asUser(t, 'admin_1', 'admin@example.com')

    // Initially, getMe and getCurrentUser return the admin
    const initialMe = await adminClient.query(api.users.getMe, {})
    expect(initialMe?._id).toBe(adminId)
    expect(initialMe?.role).toBe('room_admin')

    // Initial impersonation state is null
    const noSession = await adminClient.query(api.impersonation.getActiveSession, {})
    expect(noSession).toBeNull()

    // Start impersonation
    const res = await adminClient.mutation(api.impersonation.startImpersonation, {
      targetUserId: customerId,
      reason: 'Investigating booking reservation issue',
    })

    expect(res.success).toBe(true)
    expect(res.targetUserId).toBe(customerId)
    expect(res.expiresAt).toBeGreaterThan(Date.now())

    // Active session returns customer details
    const activeSession = await adminClient.query(api.impersonation.getActiveSession, {})
    expect(activeSession).not.toBeNull()
    expect(activeSession?.isImpersonating).toBe(true)
    expect(activeSession?.targetUserId).toBe(customerId)
    expect(activeSession?.targetEmail).toBe('customer@example.com')
    expect(activeSession?.targetRole).toBe('customer')
    expect(activeSession?.adminUserId).toBe(adminId)

    // getMe now returns the customer!
    const impersonatedMe = await adminClient.query(api.users.getMe, {})
    expect(impersonatedMe?._id).toBe(customerId)
    expect(impersonatedMe?.email).toBe('customer@example.com')
    expect(impersonatedMe?.role).toBe('customer')

    // requireCustomer succeeds under impersonation
    await t.run(async (ctx) => {
      await requireCustomer(ctx)
      // When run in unauthenticated context, throws UNAUTHORIZED
    }).catch(() => {})

    const customerCheck = await adminClient.run(async (ctx) => {
      const user = await getCurrentUser(ctx)
      const customer = await requireCustomer(ctx)
      const realAdmin = await getRealAdminUser(ctx)
      return { userRole: user?.role, customerId: customer._id, realAdminId: realAdmin._id }
    })

    expect(customerCheck.userRole).toBe('customer')
    expect(customerCheck.customerId).toBe(customerId)
    expect(customerCheck.realAdminId).toBe(adminId) // Real admin bypass works!

    // Stop impersonation
    const stopRes = await adminClient.mutation(api.impersonation.stopImpersonation, {})
    expect(stopRes.success).toBe(true)

    // Session is now ended
    const endedSession = await adminClient.query(api.impersonation.getActiveSession, {})
    expect(endedSession).toBeNull()

    // getMe returns admin again
    const restoredMe = await adminClient.query(api.users.getMe, {})
    expect(restoredMe?._id).toBe(adminId)
    expect(restoredMe?.role).toBe('room_admin')
  })

  it('allows room_admin to impersonate hotel cashier and check staff assignment', async () => {
    const t = convexTest(schema, modules)
    const adminId = await seedUser(t, 'admin_2', 'admin2@example.com', 'room_admin')
    const cashierId = await seedUser(t, 'cashier_1', 'cashier@hotel.com', 'customer')
    const hotelId = await seedHotel(t, 'Hilton Addis')
    await assignStaff(t, cashierId, hotelId, 'hotel_cashier', adminId)

    const adminClient = asUser(t, 'admin_2', 'admin2@example.com')

    // Start impersonating the cashier
    await adminClient.mutation(api.impersonation.startImpersonation, {
      targetUserId: cashierId,
      reason: 'Testing walk-in cashier flow',
    })

    // Active session contains hotel staff role and hotel details
    const session = await adminClient.query(api.impersonation.getActiveSession, {})
    expect(session?.isImpersonating).toBe(true)
    expect(session?.targetStaffRole).toBe('hotel_cashier')
    expect(session?.targetHotelId).toBe(hotelId)
    expect(session?.targetHotelName).toBe('Hilton Addis')

    // getMyAssignment returns cashier's assignment
    const myAssignment = await adminClient.query(api.hotelStaff.getMyAssignment, {})
    expect(myAssignment).not.toBeNull()
    expect(myAssignment?.role).toBe('hotel_cashier')
    expect(myAssignment?.hotelId).toBe(hotelId)

    // Stop impersonation
    await adminClient.mutation(api.impersonation.stopImpersonation, {})
    const postAssignment = await adminClient.query(api.hotelStaff.getMyAssignment, {})
    expect(postAssignment).toBeNull()
  })

  it('rejects room_admin attempting to impersonate another room_admin', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'admin_a', 'admina@example.com', 'room_admin')
    const adminBId = await seedUser(t, 'admin_b', 'adminb@example.com', 'room_admin')

    const clientA = asUser(t, 'admin_a', 'admina@example.com')

    await expect(
      clientA.mutation(api.impersonation.startImpersonation, {
        targetUserId: adminBId,
        reason: 'Attempting forbidden admin impersonation',
      }),
    ).rejects.toThrow('Room administrators cannot be impersonated.')
  })

  it('rejects room_admin attempting to impersonate self', async () => {
    const t = convexTest(schema, modules)
    const adminId = await seedUser(t, 'admin_self', 'self@example.com', 'room_admin')
    const client = asUser(t, 'admin_self', 'self@example.com')

    await expect(
      client.mutation(api.impersonation.startImpersonation, {
        targetUserId: adminId,
        reason: 'Impersonating myself',
      }),
    ).rejects.toThrow('You cannot impersonate yourself.')
  })

  it('rejects customer attempting to start impersonation', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'cust_rogue', 'rogue@example.com', 'customer')
    const victimId = await seedUser(t, 'cust_victim', 'victim@example.com', 'customer')

    const customerClient = asUser(t, 'cust_rogue', 'rogue@example.com')

    await expect(
      customerClient.mutation(api.impersonation.startImpersonation, {
        targetUserId: victimId,
        reason: 'Unauthorized attempt',
      }),
    ).rejects.toThrow('Admin access required.')
  })

  it('rejects empty or whitespace reasons', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'admin_reason', 'reason@example.com', 'room_admin')
    const custId = await seedUser(t, 'cust_target', 'target@example.com', 'customer')

    const adminClient = asUser(t, 'admin_reason', 'reason@example.com')

    await expect(
      adminClient.mutation(api.impersonation.startImpersonation, {
        targetUserId: custId,
        reason: '   ',
      }),
    ).rejects.toThrow('A reason must be provided to start impersonation.')
  })

  it('cleans up expired sessions via internal cron mutation', async () => {
    const t = convexTest(schema, modules)
    const adminId = await seedUser(t, 'admin_exp', 'adminexp@example.com', 'room_admin')
    const custId = await seedUser(t, 'cust_exp', 'custexp@example.com', 'customer')

    const adminClient = asUser(t, 'admin_exp', 'adminexp@example.com')

    // Insert an already expired session directly
    await t.run(async (ctx) => {
      await ctx.db.insert('activeImpersonations', {
        adminUserId: adminId,
        targetUserId: custId,
        reason: 'Expired test',
        startedAt: Date.now() - 40 * 60 * 1000,
        expiresAt: Date.now() - 10 * 60 * 1000, // expired 10 minutes ago
      })
      await ctx.db.insert('impersonationLogs', {
        adminUserId: adminId,
        targetUserId: custId,
        reason: 'Expired test',
        status: 'active',
        startedAt: Date.now() - 40 * 60 * 1000,
        expiresAt: Date.now() - 10 * 60 * 1000,
      })
    })

    // getActiveSession recognizes expired session as null
    const session = await adminClient.query(api.impersonation.getActiveSession, {})
    expect(session).toBeNull()

    // getCurrentUser treats expired session as normal admin
    const me = await adminClient.query(api.users.getMe, {})
    expect(me?.role).toBe('room_admin')

    // Run the cron cleanup
    await t.mutation(internal.impersonation.cleanupExpiredSessions, {})

    // Active session row is deleted and log is marked expired
    const activeCount = await t.run(async (ctx) => {
      return (await ctx.db.query('activeImpersonations').collect()).length
    })
    expect(activeCount).toBe(0)

    const log = await t.run(async (ctx) => {
      return await ctx.db
        .query('impersonationLogs')
        .withIndex('by_admin', (q) => q.eq('adminUserId', adminId))
        .first()
    })
    expect(log?.status).toBe('expired')
  })

  it('verifies getImpersonationState helper directly', async () => {
    const t = convexTest(schema, modules)
    const adminId = await seedUser(t, 'admin_state', 'adminstate@example.com', 'room_admin')
    const custId = await seedUser(t, 'cust_state', 'custstate@example.com', 'customer')

    const adminClient = asUser(t, 'admin_state', 'adminstate@example.com')

    const stateBefore = await adminClient.run(async (ctx) => {
      const { getImpersonationState } = await import('./lib/auth')
      return await getImpersonationState(ctx)
    })
    expect(stateBefore.isImpersonating).toBe(false)
    expect(stateBefore.adminUser?._id).toBe(adminId)

    await adminClient.mutation(api.impersonation.startImpersonation, {
      targetUserId: custId,
      reason: 'Testing state helper',
    })

    const stateDuring = await adminClient.run(async (ctx) => {
      const { getImpersonationState } = await import('./lib/auth')
      return await getImpersonationState(ctx)
    })
    expect(stateDuring.isImpersonating).toBe(true)
    expect(stateDuring.adminUser?._id).toBe(adminId)
    expect(stateDuring.targetUser?._id).toBe(custId)
    expect(stateDuring.reason).toBe('Testing state helper')
  })

  it('evaluates canAccessHotel and canManageHotel under hotel_admin impersonation', async () => {
    const t = convexTest(schema, modules)
    const adminId = await seedUser(t, 'admin_perm', 'adminperm@example.com', 'room_admin')
    const staffId = await seedUser(t, 'staff_perm', 'staffperm@example.com', 'customer')
    const hotel1 = await seedHotel(t, 'Hotel Alpha')
    const hotel2 = await seedHotel(t, 'Hotel Beta')
    await assignStaff(t, staffId, hotel1, 'hotel_admin', adminId)

    const adminClient = asUser(t, 'admin_perm', 'adminperm@example.com')

    await adminClient.mutation(api.impersonation.startImpersonation, {
      targetUserId: staffId,
      reason: 'Testing hotel management delegation',
    })

    const perms = await adminClient.run(async (ctx) => {
      const { canAccessHotel, canManageHotel } = await import('./lib/auth')
      return {
        canAccess1: await canAccessHotel(ctx, hotel1),
        canAccess2: await canAccessHotel(ctx, hotel2),
        canManage1: await canManageHotel(ctx, hotel1),
        canManage2: await canManageHotel(ctx, hotel2),
      }
    })

    expect(perms.canAccess1).toBe(true)
    expect(perms.canAccess2).toBe(false)
    expect(perms.canManage1).toBe(true)
    expect(perms.canManage2).toBe(false)
  })

  it('allows switching targets directly and lists logs via listLogs query', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'admin_switch', 'adminswitch@example.com', 'room_admin')
    const targetA = await seedUser(t, 'target_a', 'targeta@example.com', 'customer')
    const targetB = await seedUser(t, 'target_b', 'targetb@example.com', 'customer')

    const adminClient = asUser(t, 'admin_switch', 'adminswitch@example.com')

    // Start target A
    await adminClient.mutation(api.impersonation.startImpersonation, {
      targetUserId: targetA,
      reason: 'First session',
    })

    // Switch directly to target B without stopping first
    await adminClient.mutation(api.impersonation.startImpersonation, {
      targetUserId: targetB,
      reason: 'Second session',
    })

    const activeSession = await adminClient.query(api.impersonation.getActiveSession, {})
    expect(activeSession?.targetUserId).toBe(targetB)
    expect(activeSession?.reason).toBe('Second session')

    // listLogs returns both log events
    const logs = await adminClient.query(api.impersonation.listLogs, { limit: 10 })
    expect(logs.length).toBe(2)
    // Most recent is active target B
    expect(logs[0].targetUserId).toBe(targetB)
    expect(logs[0].status).toBe('active')
    // Previous target A was closed as ended
    expect(logs[1].targetUserId).toBe(targetA)
    expect(logs[1].status).toBe('ended')
  })

  it('rejects startImpersonation when target user does not exist', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'admin_notfound', 'adminnf@example.com', 'room_admin')
    const adminClient = asUser(t, 'admin_notfound', 'adminnf@example.com')

    // Create a temporary user and delete it to obtain a valid Id<'users'> that no longer exists
    const tempId = await seedUser(t, 'temp', 'temp@example.com', 'customer')
    await t.run(async (ctx) => {
      await ctx.db.delete(tempId)
    })

    await expect(
      adminClient.mutation(api.impersonation.startImpersonation, {
        targetUserId: tempId,
        reason: 'Target does not exist',
      }),
    ).rejects.toThrow('Target user not found.')
  })

  it('rejects unauthenticated callers for start, stop, and listLogs', async () => {
    const t = convexTest(schema, modules)
    const custId = await seedUser(t, 'cust_anon', 'anon@example.com', 'customer')

    // Unauthenticated context (no withIdentity)
    await expect(
      t.mutation(api.impersonation.startImpersonation, {
        targetUserId: custId,
        reason: 'Anonymous attempt',
      }),
    ).rejects.toThrow('Not authenticated. Please sign in.')

    await expect(
      t.mutation(api.impersonation.stopImpersonation, {}),
    ).rejects.toThrow('Not authenticated. Please sign in.')

    await expect(
      t.query(api.impersonation.listLogs, {}),
    ).rejects.toThrow('Not authenticated. Please sign in.')

    // getActiveSession returns null gracefully for unauthenticated caller
    const active = await t.query(api.impersonation.getActiveSession, {})
    expect(active).toBeNull()
  })

  it('allows stopImpersonation to be called idempotently when no session is active', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'admin_idemp', 'adminidemp@example.com', 'room_admin')
    const adminClient = asUser(t, 'admin_idemp', 'adminidemp@example.com')

    // Stop when no session has ever been created
    const res = await adminClient.mutation(api.impersonation.stopImpersonation, {})
    expect(res.success).toBe(true)
  })

  it('rejects customer calling stopImpersonation or listLogs', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'cust_stop', 'custstop@example.com', 'customer')
    const custClient = asUser(t, 'cust_stop', 'custstop@example.com')

    await expect(
      custClient.mutation(api.impersonation.stopImpersonation, {}),
    ).rejects.toThrow('Admin access required.')

    await expect(
      custClient.query(api.impersonation.listLogs, {}),
    ).rejects.toThrow('Admin access required.')
  })

  it('seamlessly reverts getCurrentUser and getActiveSession to admin when TTL expires without cleanup', async () => {
    const t = convexTest(schema, modules)
    const adminId = await seedUser(t, 'admin_ttl', 'adminttl@example.com', 'room_admin')
    const custId = await seedUser(t, 'cust_ttl', 'custttl@example.com', 'customer')
    const adminClient = asUser(t, 'admin_ttl', 'adminttl@example.com')

    // Start impersonation
    await adminClient.mutation(api.impersonation.startImpersonation, {
      targetUserId: custId,
      reason: 'TTL elapsing test',
    })

    // Confirm impersonation is active
    const duringMe = await adminClient.query(api.users.getMe, {})
    expect(duringMe?._id).toBe(custId)

    // Artificially age the activeImpersonations row so its expiresAt is in the past
    await t.run(async (ctx) => {
      const active = await ctx.db
        .query('activeImpersonations')
        .withIndex('by_admin', (q) => q.eq('adminUserId', adminId))
        .first()
      if (active) {
        await ctx.db.patch(active._id, {
          expiresAt: Date.now() - 1000,
        })
      }
    })

    // Even though cleanup cron has NOT run yet, queries immediately revert to admin
    const revertedSession = await adminClient.query(api.impersonation.getActiveSession, {})
    expect(revertedSession).toBeNull()

    const revertedMe = await adminClient.query(api.users.getMe, {})
    expect(revertedMe?._id).toBe(adminId)
    expect(revertedMe?.role).toBe('room_admin')
  })
})

