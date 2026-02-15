import { QueryCtx, MutationCtx } from '../_generated/server'
import { ConvexError } from 'convex/values'
import { Doc, Id } from '../_generated/dataModel'

export type UserRole = 'customer' | 'room_admin'
export type HotelStaffRole = 'hotel_admin' | 'hotel_cashier'

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

export async function getHotelAssignment(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<Doc<'hotelStaff'> | null> {
  return await ctx.db
    .query('hotelStaff')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
}

export async function canAccessHotel(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
  hotelId: Id<'hotels'>,
): Promise<boolean> {
  const user = await getCurrentUser(ctx, clerkUserId)
  if (!user) {
    return false
  }

  if (user.role === 'room_admin') {
    return true
  }

  const assignment = await getHotelAssignment(ctx, user._id)
  return Boolean(assignment && assignment.hotelId === hotelId)
}

export async function requireHotelAccess(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
  hotelId: Id<'hotels'>,
): Promise<{ user: Doc<'users'>; assignment: Doc<'hotelStaff'> | null }> {
  const user = await requireUser(ctx, clerkUserId)

  if (user.role === 'room_admin') {
    return { user, assignment: null }
  }

  const assignment = await getHotelAssignment(ctx, user._id)
  if (!assignment || assignment.hotelId !== hotelId) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this hotel.',
    })
  }

  return { user, assignment }
}

export async function canManageHotel(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
  hotelId: Id<'hotels'>,
): Promise<boolean> {
  const { user, assignment } = await requireHotelAccess(ctx, clerkUserId, hotelId)

  if (user.role === 'room_admin') {
    return true
  }

  return assignment?.role === 'hotel_admin'
}

export async function requireHotelManagement(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
  hotelId: Id<'hotels'>,
): Promise<{ user: Doc<'users'>; assignment: Doc<'hotelStaff'> | null }> {
  const access = await requireHotelAccess(ctx, clerkUserId, hotelId)

  if (access.user.role === 'room_admin') {
    return access
  }

  if (access.assignment?.role !== 'hotel_admin') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Only hotel administrators can perform this action.',
    })
  }

  return access
}
