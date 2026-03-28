import { internalMutation, internalQuery, query } from './_generated/server'
import { v } from 'convex/values'

const userValidator = v.object({
  _id: v.id('users'),
  _creationTime: v.number(),
  clerkUserId: v.string(),
  email: v.string(),
  role: v.union(v.literal('customer'), v.literal('room_admin')),
  createdAt: v.number(),
})

// Authenticated query returning the current user's own record.
// Identity is derived from the Clerk JWT token — no arguments needed.
// Returns null while the token is loading or if the user record hasn't been
// synced from Clerk yet.
export const getMe = query({
  args: {},
  returns: v.union(userValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .unique()
  },
})

export const getByClerkUserId = internalQuery({
  args: {
    clerkUserId: v.string(),
  },
  returns: v.union(userValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', args.clerkUserId),
      )
      .unique()
  },
})

// Internal mutation to safely create a new user record from a webhook event.
// Uses an idempotency check to guarantee a user with the same Clerk User ID is
// not inserted twice. Only callable by other Convex functions.
export const createUser = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    role: v.union(v.literal('customer'), v.literal('room_admin')),
  },
  returns: v.union(v.id('users'), v.null()),
  handler: async (ctx, args) => {
    // Idempotency check - don't create if already exists
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    if (existingUser) {
      return null // Already exists
    }

    return await ctx.db.insert('users', {
      clerkUserId: args.clerkUserId,
      email: args.email,
      role: args.role,
      createdAt: Date.now(),
    })
  },
})
