import { QueryCtx, MutationCtx } from '../_generated/server'
import { ConvexError } from 'convex/values'
import { Doc, Id } from '../_generated/dataModel'

export type UserRole = 'customer' | 'room_admin'
export type HotelStaffRole = 'hotel_admin' | 'hotel_cashier'

// ---------------------------------------------------------------------------
// Core identity helpers — JWT-verified, never from args
// ---------------------------------------------------------------------------

/**
 * Verify the caller's identity from the Clerk JWT token.
 * Returns the verified Clerk user ID (`identity.subject`).
 * Throws UNAUTHORIZED if no valid token is present.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated. Please sign in.',
    })
  }
  return identity.subject // Clerk user ID, cryptographically verified
}

/**
 * Get the current user from the database using their verified JWT identity.
 * Returns null if user record not found.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'> | null> {
  const clerkUserId = await requireAuth(ctx)
  return await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
    .unique()
}

// ---------------------------------------------------------------------------
// Role-gated helpers
// ---------------------------------------------------------------------------

/**
 * Get the current user or throw an error if not found.
 * Identity derived from JWT — never from args.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'>> {
  const user = await getCurrentUser(ctx)
  if (!user) {
    throw new ConvexError({
      code: 'UNAUTHORIZED',
      message: 'User not found. Please sign in.',
    })
  }
  return user
}

/**
 * Require the user to have admin role.
 * Throws ConvexError if user is not a room_admin.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
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
 * Require the user to have customer role.
 * Throws ConvexError if user is not a customer.
 */
export async function requireCustomer(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  if (user.role !== 'customer') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Customer access required. Admins cannot perform this action.',
    })
  }
  return user
}

/**
 * Check if user is admin (doesn't throw, returns boolean).
 * Returns false if not authenticated or user not found.
 */
export async function isAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return false
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) =>
      q.eq('clerkUserId', identity.subject),
    )
    .unique()
  return user?.role === 'room_admin'
}

/**
 * Check if user is customer (doesn't throw, returns boolean).
 * Returns false if not authenticated or user not found.
 */
export async function isCustomer(
  ctx: QueryCtx | MutationCtx,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return false
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) =>
      q.eq('clerkUserId', identity.subject),
    )
    .unique()
  return user?.role === 'customer'
}

// ---------------------------------------------------------------------------
// Convex-ID based helpers (no change — already take Convex Id, not Clerk Id)
// ---------------------------------------------------------------------------

/**
 * Get user by their Convex user ID.
 */
export async function getUserById(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<Doc<'users'> | null> {
  return await ctx.db.get(userId)
}

/**
 * Retrieves the hotelStaff assignment record for a specific user ID.
 * Indicates which hotel the user has administrative or cashier privileges for.
 */
export async function getHotelAssignment(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<Doc<'hotelStaff'> | null> {
  return await ctx.db
    .query('hotelStaff')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
}

// ---------------------------------------------------------------------------
// Hotel-scoped access helpers
// ---------------------------------------------------------------------------

/**
 * Evaluates whether the authenticated user can access a specific hotel.
 * Returns false instead of throwing. A room_admin automatically has access.
 */
export async function canAccessHotel(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<'hotels'>,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return false

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) =>
      q.eq('clerkUserId', identity.subject),
    )
    .unique()
  if (!user) return false

  if (user.role === 'room_admin') return true

  const assignment = await getHotelAssignment(ctx, user._id)
  return Boolean(assignment && assignment.hotelId === hotelId)
}

/**
 * Demands that the authenticated user possesses valid access to a specified hotel
 * (either as an assigned hotel staff member or a global room_admin).
 * Throws a ConvexError if unauthorized.
 */
export async function requireHotelAccess(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<'hotels'>,
): Promise<{ user: Doc<'users'>; assignment: Doc<'hotelStaff'> | null }> {
  const user = await requireUser(ctx)

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

/**
 * Evaluates whether the authenticated user can manage a specific hotel.
 * Returns false instead of throwing. A room_admin or hotel_admin has access.
 */
export async function canManageHotel(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<'hotels'>,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return false

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) =>
      q.eq('clerkUserId', identity.subject),
    )
    .unique()
  if (!user) return false

  if (user.role === 'room_admin') return true

  const assignment = await getHotelAssignment(ctx, user._id)
  if (!assignment || assignment.hotelId !== hotelId) return false

  return assignment.role === 'hotel_admin'
}

/**
 * Validates that the authenticated user possesses administrative-level management
 * rights over a hotel (i.e. room_admin or a hotel_admin assignment to the hotel).
 * Throws a ConvexError if the user is unauthorized.
 */
export async function requireHotelManagement(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<'hotels'>,
): Promise<{ user: Doc<'users'>; assignment: Doc<'hotelStaff'> | null }> {
  const access = await requireHotelAccess(ctx, hotelId)

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
