import { query, internalMutation } from './_generated/server'
import { v } from 'convex/values'

// Public query to fetch the user document matching the provided Clerk User ID.
// Useful for clients to determine their own role and verify that their Convex
// user record has been correctly synced after sign-in. Returns null if not found.
export const getByClerkId = query({
  args: { clerkUserId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id('users'),
      _creationTime: v.number(),
      clerkUserId: v.string(),
      email: v.string(),
      role: v.union(v.literal('customer'), v.literal('room_admin')),
      createdAt: v.number(),
    }),
    v.null(),
  ),
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
