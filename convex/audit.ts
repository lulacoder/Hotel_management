import { v } from 'convex/values'
import { internalMutation, query } from './_generated/server'
import { requireAdmin } from './lib/auth'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

// Type for target types
export type AuditTargetType =
  | 'hotel'
  | 'room'
  | 'booking'
  | 'rating'
  | 'user'
  | 'staff_invitation'

// Records an audit event on behalf of another server function
export const logEvent = internalMutation({
  args: {
    actorId: v.optional(v.id('users')),
    action: v.string(),
    targetType: v.union(
      v.literal('hotel'),
      v.literal('room'),
      v.literal('booking'),
      v.literal('rating'),
      v.literal('user'),
      v.literal('staff_invitation'),
    ),
    targetId: v.string(),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.id('auditEvents'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('auditEvents', {
      actorId: args.actorId,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      previousValue: args.previousValue,
      newValue: args.newValue,
      metadata: args.metadata,
      timestamp: Date.now(),
    })
  },
})

// Inserts an audit event in the caller's mutation transaction
export async function createAuditLog(
  ctx: MutationCtx,
  params: {
    actorId?: Id<'users'>
    action: string
    targetType: AuditTargetType
    targetId: string
    previousValue?: unknown
    newValue?: unknown
    metadata?: Record<string, unknown>
  },
): Promise<Id<'auditEvents'>> {
  return await ctx.db.insert('auditEvents', {
    actorId: params.actorId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    previousValue: params.previousValue
      ? JSON.stringify(params.previousValue)
      : undefined,
    newValue: params.newValue ? JSON.stringify(params.newValue) : undefined,
    metadata: params.metadata,
    timestamp: Date.now(),
  })
}

// Lets a room admin list audit events for one target
export const getByTarget = query({
  args: {
    targetType: v.union(
      v.literal('hotel'),
      v.literal('room'),
      v.literal('booking'),
      v.literal('rating'),
      v.literal('user'),
      v.literal('staff_invitation'),
    ),
    targetId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('auditEvents'),
      _creationTime: v.number(),
      actorId: v.optional(v.id('users')),
      action: v.string(),
      targetType: v.union(
        v.literal('hotel'),
        v.literal('room'),
        v.literal('booking'),
        v.literal('rating'),
        v.literal('user'),
        v.literal('staff_invitation'),
      ),
      targetId: v.string(),
      previousValue: v.optional(v.string()),
      newValue: v.optional(v.string()),
      metadata: v.optional(v.record(v.string(), v.any())),
      timestamp: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // Only admins can view audit logs
    await requireAdmin(ctx)

    const limit = args.limit ?? 50

    return await ctx.db
      .query('auditEvents')
      .withIndex('by_target', (q) =>
        q.eq('targetType', args.targetType).eq('targetId', args.targetId),
      )
      .order('desc')
      .take(limit)
  },
})

// Lets a room admin list the most recent audit events
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('auditEvents'),
      _creationTime: v.number(),
      actorId: v.optional(v.id('users')),
      action: v.string(),
      targetType: v.union(
        v.literal('hotel'),
        v.literal('room'),
        v.literal('booking'),
        v.literal('rating'),
        v.literal('user'),
        v.literal('staff_invitation'),
      ),
      targetId: v.string(),
      previousValue: v.optional(v.string()),
      newValue: v.optional(v.string()),
      metadata: v.optional(v.record(v.string(), v.any())),
      timestamp: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // Only admins can view audit logs
    await requireAdmin(ctx)

    const limit = args.limit ?? 50

    return await ctx.db
      .query('auditEvents')
      .withIndex('by_timestamp')
      .order('desc')
      .take(limit)
  },
})
