import { query, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { Id } from './_generated/dataModel'
import { MutationCtx } from './_generated/server'
import { requireAdmin } from './lib/auth'

// Type for target types
export type AuditTargetType = 'hotel' | 'room' | 'booking'

// Internal mutation for logging audit events (called from other mutations)
export const logEvent = internalMutation({
  args: {
    actorId: v.id('users'),
    action: v.string(),
    targetType: v.union(
      v.literal('hotel'),
      v.literal('room'),
      v.literal('booking'),
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

// Helper function to create audit log directly within a mutation context
// This avoids the need for scheduler for inline audit logging
export async function createAuditLog(
  ctx: MutationCtx,
  params: {
    actorId: Id<'users'>
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

// Query audit events by target (admin only)
export const getByTarget = query({
  args: {
    clerkUserId: v.string(),
    targetType: v.union(
      v.literal('hotel'),
      v.literal('room'),
      v.literal('booking'),
    ),
    targetId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('auditEvents'),
      _creationTime: v.number(),
      actorId: v.id('users'),
      action: v.string(),
      targetType: v.union(
        v.literal('hotel'),
        v.literal('room'),
        v.literal('booking'),
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
    await requireAdmin(ctx, args.clerkUserId)

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

// Query recent audit events (admin only)
export const getRecent = query({
  args: {
    clerkUserId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('auditEvents'),
      _creationTime: v.number(),
      actorId: v.id('users'),
      action: v.string(),
      targetType: v.union(
        v.literal('hotel'),
        v.literal('room'),
        v.literal('booking'),
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
    await requireAdmin(ctx, args.clerkUserId)

    const limit = args.limit ?? 50

    return await ctx.db
      .query('auditEvents')
      .withIndex('by_timestamp')
      .order('desc')
      .take(limit)
  },
})
