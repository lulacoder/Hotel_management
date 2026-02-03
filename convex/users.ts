import { query, internalMutation } from './_generated/server'
import { v } from 'convex/values'

// Public query to get user by Clerk ID
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

// Internal mutation - only callable from other Convex functions (webhook)
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
