import { ConvexError, v } from 'convex/values'

import { internalMutation, mutation, query } from './_generated/server'
import { createAuditLog } from './audit'
import { getRealAdminUser } from './lib/auth'

const IMPERSONATION_TTL_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Start an impersonation session.
 * Only room_admin users can impersonate other non-room_admin users.
 * Upserts activeImpersonations with a 30-minute TTL and records an audit log.
 */
export const startImpersonation = mutation({
  args: {
    targetUserId: v.id('users'),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    expiresAt: v.number(),
    targetUserId: v.id('users'),
  }),
  handler: async (ctx, args) => {
    // Only real room_admin can initiate impersonation
    const adminUser = await getRealAdminUser(ctx)

    const trimmedReason = args.reason.trim()
    if (!trimmedReason) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'A reason must be provided to start impersonation.',
      })
    }

    const targetUser = await ctx.db.get(args.targetUserId)
    if (!targetUser) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Target user not found.',
      })
    }

    if (targetUser._id === adminUser._id) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'You cannot impersonate yourself.',
      })
    }

    // Privilege constraint: Room administrators can never be impersonated
    if (targetUser.role === 'room_admin') {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Room administrators cannot be impersonated.',
      })
    }

    const now = Date.now()
    const expiresAt = now + IMPERSONATION_TTL_MS

    // Close any previous active logs for this admin
    const activeLogs = await ctx.db
      .query('impersonationLogs')
      .withIndex('by_admin', (q) => q.eq('adminUserId', adminUser._id))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect()

    for (const log of activeLogs) {
      await ctx.db.patch(log._id, {
        status: 'ended',
        endedAt: now,
      })
    }

    // Upsert active session for this admin
    const existing = await ctx.db
      .query('activeImpersonations')
      .withIndex('by_admin', (q) => q.eq('adminUserId', adminUser._id))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        targetUserId: targetUser._id,
        reason: trimmedReason,
        startedAt: now,
        expiresAt,
      })
    } else {
      await ctx.db.insert('activeImpersonations', {
        adminUserId: adminUser._id,
        targetUserId: targetUser._id,
        reason: trimmedReason,
        startedAt: now,
        expiresAt,
      })
    }

    // Log the new impersonation event
    await ctx.db.insert('impersonationLogs', {
      adminUserId: adminUser._id,
      targetUserId: targetUser._id,
      reason: trimmedReason,
      status: 'active',
      startedAt: now,
      expiresAt,
    })

    // Record system audit log
    await createAuditLog(ctx, {
      actorId: adminUser._id,
      action: 'impersonation_started',
      targetType: 'user',
      targetId: targetUser._id,
      metadata: {
        adminEmail: adminUser.email,
        targetEmail: targetUser.email,
        targetRole: targetUser.role,
        reason: trimmedReason,
        expiresAt,
      },
    })

    return {
      success: true,
      expiresAt,
      targetUserId: targetUser._id,
    }
  },
})

/**
 * End the current admin caller's impersonation session.
 * Clears activeImpersonations and marks active logs as ended.
 */
export const stopImpersonation = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx) => {
    const adminUser = await getRealAdminUser(ctx)
    const now = Date.now()

    const activeList = await ctx.db
      .query('activeImpersonations')
      .withIndex('by_admin', (q) => q.eq('adminUserId', adminUser._id))
      .collect()

    for (const active of activeList) {
      await ctx.db.delete(active._id)
    }

    const activeLogs = await ctx.db
      .query('impersonationLogs')
      .withIndex('by_admin', (q) => q.eq('adminUserId', adminUser._id))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect()

    for (const log of activeLogs) {
      await ctx.db.patch(log._id, {
        status: 'ended',
        endedAt: now,
      })
    }

    if (activeList.length > 0) {
      await createAuditLog(ctx, {
        actorId: adminUser._id,
        action: 'impersonation_ended',
        targetType: 'user',
        targetId: activeList[0].targetUserId,
        metadata: {
          adminEmail: adminUser.email,
          durationMs: now - activeList[0].startedAt,
        },
      })
    }

    return {
      success: true,
    }
  },
})

const activeSessionValidator = v.union(
  v.object({
    isImpersonating: v.boolean(),
    adminUserId: v.id('users'),
    adminEmail: v.string(),
    targetUserId: v.id('users'),
    targetEmail: v.string(),
    targetRole: v.union(v.literal('customer'), v.literal('room_admin')),
    targetStaffRole: v.optional(
      v.union(v.literal('hotel_admin'), v.literal('hotel_cashier'), v.null()),
    ),
    targetHotelId: v.optional(v.union(v.id('hotels'), v.null())),
    targetHotelName: v.optional(v.union(v.string(), v.null())),
    reason: v.string(),
    startedAt: v.number(),
    expiresAt: v.number(),
  }),
  v.null(),
)

/**
 * Returns active impersonation info for the caller if they are a room_admin
 * and currently have an active, unexpired session. Returns null otherwise.
 */
export const getActiveSession = query({
  args: {},
  returns: activeSessionValidator,
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const callerUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .unique()

    if (!callerUser || callerUser.role !== 'room_admin') {
      return null
    }

    const active = await ctx.db
      .query('activeImpersonations')
      .withIndex('by_admin', (q) => q.eq('adminUserId', callerUser._id))
      .first()

    if (!active) {
      return null
    }

    // Check expiration
    if (active.expiresAt <= Date.now()) {
      return null
    }

    const targetUser = await ctx.db.get(active.targetUserId)
    if (!targetUser) {
      return null
    }

    const assignment = await ctx.db
      .query('hotelStaff')
      .withIndex('by_user', (q) => q.eq('userId', targetUser._id))
      .unique()

    let hotelName: string | null = null
    if (assignment) {
      const hotel = await ctx.db.get(assignment.hotelId)
      hotelName = hotel?.name ?? null
    }

    return {
      isImpersonating: true,
      adminUserId: callerUser._id,
      adminEmail: callerUser.email,
      targetUserId: targetUser._id,
      targetEmail: targetUser.email,
      targetRole: targetUser.role,
      targetStaffRole: assignment?.role ?? null,
      targetHotelId: assignment?.hotelId ?? null,
      targetHotelName: hotelName,
      reason: active.reason,
      startedAt: active.startedAt,
      expiresAt: active.expiresAt,
    }
  },
})

/**
 * Internal cron task to clean up expired sessions and mark logs as 'expired'.
 */
export const cleanupExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const activeList = await ctx.db.query('activeImpersonations').collect()

    for (const active of activeList) {
      if (active.expiresAt <= now) {
        await ctx.db.delete(active._id)
      }
    }

    const expiredLogs = await ctx.db
      .query('impersonationLogs')
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'active'),
          q.lte(q.field('expiresAt'), now),
        ),
      )
      .collect()

    for (const log of expiredLogs) {
      await ctx.db.patch(log._id, {
        status: 'expired',
        endedAt: now,
      })
    }
  },
})

/**
 * List recent impersonation logs for auditing purposes.
 * Only room admins can view logs.
 */
export const listLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getRealAdminUser(ctx)
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100)
    return await ctx.db
      .query('impersonationLogs')
      .withIndex('by_started_at')
      .order('desc')
      .take(limit)
  },
})
