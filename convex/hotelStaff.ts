import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { createAuditLog } from './audit'
import {
  getHotelAssignment,
  requireAdmin,
  requireHotelAccess,
  requireUser,
} from './lib/auth'

const hotelStaffRoleValidator = v.union(
  v.literal('hotel_admin'),
  v.literal('hotel_cashier'),
)

const hotelAssignmentValidator = v.object({
  _id: v.id('hotelStaff'),
  _creationTime: v.number(),
  userId: v.id('users'),
  hotelId: v.id('hotels'),
  role: hotelStaffRoleValidator,
  assignedAt: v.number(),
  assignedBy: v.id('users'),
})

// Returns the authenticated user's own hotel staff assignment, if any.
// Identity is derived from the Clerk JWT — no arguments needed.
// Returns null if not authenticated, user not found, or no assignment exists.
export const getMyAssignment = query({
  args: {},
  returns: v.union(hotelAssignmentValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .unique()
    if (!user) {
      return null
    }
    return await ctx.db
      .query('hotelStaff')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique()
  },
})

// Lists all users in the system alongside their active hotel staff assignment (if any).
// Requires the caller to have the 'room_admin' role. The assignment details include
// the hotel's name and city for easier administration.
export const listAllUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('users'),
      clerkUserId: v.string(),
      email: v.string(),
      role: v.union(v.literal('customer'), v.literal('room_admin')),
      createdAt: v.number(),
      assignment: v.optional(
        v.object({
          _id: v.id('hotelStaff'),
          hotelId: v.id('hotels'),
          role: hotelStaffRoleValidator,
          assignedAt: v.number(),
          hotelName: v.string(),
          hotelCity: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, _args) => {
    await requireAdmin(ctx)

    const users = await ctx.db.query('users').collect()
    const result = []

    for (const user of users) {
      const assignment = await ctx.db
        .query('hotelStaff')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .unique()

      if (!assignment) {
        result.push({
          _id: user._id,
          clerkUserId: user.clerkUserId,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        })
        continue
      }

      const hotel = await ctx.db.get(assignment.hotelId)
      result.push({
        _id: user._id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        assignment: {
          _id: assignment._id,
          hotelId: assignment.hotelId,
          role: assignment.role,
          assignedAt: assignment.assignedAt,
          hotelName: hotel?.name ?? 'Unknown hotel',
          hotelCity: hotel?.city ?? 'Unknown city',
        },
      })
    }

    return result
  },
})

// Fetches the specific hotel staff assignment for a given user ID.
// If the caller is not a 'room_admin', they can only view the assignment if they
// themselves are assigned to the same hotel as the target user.
export const getByUserId = query({
  args: {
    userId: v.id('users'),
  },
  returns: v.union(hotelAssignmentValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    if (user.role !== 'room_admin' && user._id !== args.userId) {
      const currentAssignment = await getHotelAssignment(ctx, user._id)
      const requestedAssignment = await getHotelAssignment(ctx, args.userId)

      const sameHotel =
        currentAssignment &&
        requestedAssignment &&
        currentAssignment.hotelId === requestedAssignment.hotelId

      if (!sameHotel) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this assignment.',
        })
      }
    }

    return await ctx.db
      .query('hotelStaff')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()
  },
})

// Lists all hotel staff assigned to a specific hotel, along with their user emails.
// Requires the caller to have access to the target hotel.
export const getByHotelId = query({
  args: {
    hotelId: v.id('hotels'),
  },
  returns: v.array(
    v.object({
      assignment: hotelAssignmentValidator,
      userEmail: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireHotelAccess(ctx, args.hotelId)

    const assignments = await ctx.db
      .query('hotelStaff')
      .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
      .collect()

    const result = []
    for (const assignment of assignments) {
      const assignedUser = await ctx.db.get(assignment.userId)
      result.push({
        assignment,
        userEmail: assignedUser?.email ?? 'Unknown user',
      })
    }

    return result
  },
})

// Assigns a user to a specific hotel with a designated staff role ('hotel_admin' or 'hotel_cashier').
// Only callable by a 'room_admin'. Verifies that the user and hotel both exist
// and that the user does not already have a hotel assignment. Logs an audit event.
export const assign = mutation({
  args: {
    targetUserId: v.id('users'),
    hotelId: v.id('hotels'),
    role: hotelStaffRoleValidator,
  },
  returns: v.id('hotelStaff'),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const targetUser = await ctx.db.get(args.targetUserId)
    if (!targetUser) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Target user not found.',
      })
    }

    const existingAssignment = await ctx.db
      .query('hotelStaff')
      .withIndex('by_user', (q) => q.eq('userId', args.targetUserId))
      .unique()

    if (existingAssignment) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'User is already assigned to a hotel. Unassign first.',
      })
    }

    const hotel = await ctx.db.get(args.hotelId)
    if (!hotel || hotel.isDeleted) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Hotel not found.',
      })
    }

    const assignmentId = await ctx.db.insert('hotelStaff', {
      userId: args.targetUserId,
      hotelId: args.hotelId,
      role: args.role,
      assignedAt: Date.now(),
      assignedBy: admin._id,
    })

    await createAuditLog(ctx, {
      actorId: admin._id,
      action: 'hotel_staff_assigned',
      targetType: 'user',
      targetId: args.targetUserId,
      newValue: {
        hotelId: args.hotelId,
        role: args.role,
      },
      metadata: {
        assignmentId,
      },
    })

    return assignmentId
  },
})

// Unassigns a user from a hotel, removing their staff privileges for that hotel.
// Requires the caller to be a 'room_admin'. Verifies that the user actually has
// a hotel assignment before deleting it. Logs an audit event for the unassignment.
export const unassign = mutation({
  args: {
    targetUserId: v.id('users'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const existingAssignment = await ctx.db
      .query('hotelStaff')
      .withIndex('by_user', (q) => q.eq('userId', args.targetUserId))
      .unique()

    if (!existingAssignment) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'User has no hotel assignment.',
      })
    }

    await ctx.db.delete(existingAssignment._id)

    await createAuditLog(ctx, {
      actorId: admin._id,
      action: 'hotel_staff_unassigned',
      targetType: 'user',
      targetId: args.targetUserId,
      previousValue: {
        hotelId: existingAssignment.hotelId,
        role: existingAssignment.role,
      },
      metadata: {
        assignmentId: existingAssignment._id,
      },
    })

    return null
  },
})
