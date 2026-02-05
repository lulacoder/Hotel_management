import { QueryCtx, MutationCtx } from '../_generated/server'
import { ConvexError } from 'convex/values'
import { Doc, Id } from '../_generated/dataModel'

export type UserRole = 'customer' | 'room_admin'

/**
 * Get the current user from the database by their Clerk user ID
 * Returns null if user not found
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<Doc<'users'> | null> {
  return await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
    .unique()
}

/**
 * Get the current user or throw an error if not found
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<Doc<'users'>> {
  const user = await getCurrentUser(ctx, clerkUserId)
  if (!user) {
    throw new ConvexError({
      code: 'UNAUTHORIZED',
      message: 'User not found. Please sign in.',
    })
  }
  return user
}

/**
 * Require the user to have admin role
 * Throws ConvexError if user is not an admin
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx, clerkUserId)
  if (user.role !== 'room_admin') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message:
        'Admin access required. You do not have permission to perform this action.',
    })
  }
  return user
}

/**
 * Require the user to have customer role
 * Throws ConvexError if user is not a customer
 */
export async function requireCustomer(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx, clerkUserId)
  if (user.role !== 'customer') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Customer access required. Admins cannot perform this action.',
    })
  }
  return user
}

/**
 * Check if user is admin (doesn't throw, returns boolean)
 */
export async function isAdmin(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<boolean> {
  const user = await getCurrentUser(ctx, clerkUserId)
  return user?.role === 'room_admin'
}

/**
 * Check if user is customer (doesn't throw, returns boolean)
 */
export async function isCustomer(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<boolean> {
  const user = await getCurrentUser(ctx, clerkUserId)
  return user?.role === 'customer'
}

/**
 * Get user by their Convex user ID
 */
export async function getUserById(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<Doc<'users'> | null> {
  return await ctx.db.get(userId)
}
