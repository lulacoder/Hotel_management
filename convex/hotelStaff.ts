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

export const listAllUsers = query({
  args: {
    clerkUserId: v.string(),
  },
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
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.clerkUserId)

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

export const getByUserId = query({
  args: {
    clerkUserId: v.string(),
    userId: v.id('users'),
  },
  returns: v.union(hotelAssignmentValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkUserId)

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

export const getByHotelId = query({
  args: {
    clerkUserId: v.string(),
    hotelId: v.id('hotels'),
  },
  returns: v.array(
    v.object({
      assignment: hotelAssignmentValidator,
      userEmail: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireHotelAccess(ctx, args.clerkUserId, args.hotelId)

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

export const assign = mutation({
  args: {
    clerkUserId: v.string(),
    targetUserId: v.id('users'),
    hotelId: v.id('hotels'),
    role: hotelStaffRoleValidator,
  },
  returns: v.id('hotelStaff'),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.clerkUserId)

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

export const unassign = mutation({
  args: {
    clerkUserId: v.string(),
    targetUserId: v.id('users'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.clerkUserId)

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
