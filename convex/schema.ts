import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Users table for role-based authentication
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    role: v.union(v.literal('customer'), v.literal('room_admin')),
    createdAt: v.number(),
  })
    .index('by_clerk_user_id', ['clerkUserId'])
    .index('by_email', ['email'])
    .index('by_role', ['role']),
})
