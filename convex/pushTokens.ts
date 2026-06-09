import { ConvexError, v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
} from './_generated/server'
import { requireUser } from './lib/auth'

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const platformValidator = v.union(v.literal('ios'), v.literal('android'))

// ---------------------------------------------------------------------------
// Public Mutations
// ---------------------------------------------------------------------------

// Registers (or refreshes) the current user's Expo push token. Idempotent.
// If the same token is already owned by a different user (device handoff),
// that prior row is removed first so a single device only ever pushes to the
// currently signed-in account.
export const registerPushToken = mutation({
  args: {
    token: v.string(),
    platform: platformValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    if (!args.token.startsWith('ExponentPushToken[')) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'Invalid Expo push token format.',
      })
    }

    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    const now = Date.now()

    if (existing) {
      if (existing.userId === user._id) {
        await ctx.db.patch(existing._id, {
          lastSeenAt: now,
          platform: args.platform,
        })
        return null
      }
      await ctx.db.delete(existing._id)
    }

    await ctx.db.insert('pushTokens', {
      userId: user._id,
      token: args.token,
      platform: args.platform,
      createdAt: now,
      lastSeenAt: now,
    })

    return null
  },
})

// Removes a push token. Called on sign-out so the device stops receiving
// pushes for the account that just signed out.
export const unregisterPushToken = mutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (existing && existing.userId === user._id) {
      await ctx.db.delete(existing._id)
    }

    return null
  },
})

// ---------------------------------------------------------------------------
// Internal helpers used by the push action
// ---------------------------------------------------------------------------

export const getTokensForUser = internalQuery({
  args: {
    userId: v.id('users'),
  },
  returns: v.array(
    v.object({
      _id: v.id('pushTokens'),
      _creationTime: v.number(),
      userId: v.id('users'),
      token: v.string(),
      platform: platformValidator,
      createdAt: v.number(),
      lastSeenAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('pushTokens')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()
  },
})

// Deletes a single token by its string value. Used by the push action to
// purge tokens Expo reports as DeviceNotRegistered.
export const deleteByToken = internalMutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }

    return null
  },
})
