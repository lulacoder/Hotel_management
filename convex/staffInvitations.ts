import { ConvexError, v } from 'convex/values'

import { createAuditLog } from './audit'
import { internalMutation, mutation, query } from './_generated/server'
import { getHotelAssignment, requireUser } from './lib/auth'
import { uniqueIds } from './lib/arrays'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

const hotelStaffRoleValidator = v.union(
  v.literal('hotel_admin'),
  v.literal('hotel_cashier'),
)

const invitationStatusValidator = v.union(
  v.literal('pending'),
  v.literal('accepted'),
  v.literal('revoked'),
)

const effectiveStatusValidator = v.union(
  invitationStatusValidator,
  v.literal('expired'),
)

const deliveryStatusValidator = v.union(
  v.literal('pending'),
  v.literal('queued'),
  v.literal('failed'),
)

const invitationListItemValidator = v.object({
  _id: v.id('hotelStaffInvitations'),
  email: v.string(),
  hotelId: v.id('hotels'),
  hotelName: v.string(),
  hotelCity: v.string(),
  role: hotelStaffRoleValidator,
  status: effectiveStatusValidator,
  invitedByEmail: v.string(),
  createdAt: v.number(),
  expiresAt: v.number(),
  lastSentAt: v.optional(v.number()),
  deliveryStatus: deliveryStatusValidator,
  resendCount: v.number(),
  acceptedAt: v.optional(v.number()),
  revokedAt: v.optional(v.number()),
})

const invitationEmailContextValidator = v.object({
  invitationId: v.id('hotelStaffInvitations'),
  email: v.string(),
  hotelName: v.string(),
  hotelCity: v.string(),
  role: hotelStaffRoleValidator,
  invitedByEmail: v.string(),
  expiresAt: v.number(),
})

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function requireValidEmail(email: string) {
  const normalized = normalizeEmail(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: 'Enter a valid email address.',
    })
  }
  return normalized
}

function getEffectiveStatus(
  status: 'pending' | 'accepted' | 'revoked',
  expiresAt: number,
): 'pending' | 'expired' | 'accepted' | 'revoked' {
  return status === 'pending' && expiresAt <= Date.now() ? 'expired' : status
}

// Centralizes the invitation permission matrix so every action applies the
// same room-admin and hotel-admin boundaries.
async function requireInvitationManager(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<'hotels'>,
  role?: 'hotel_admin' | 'hotel_cashier',
) {
  const actor = await requireUser(ctx)
  if (actor.role === 'room_admin') {
    return actor
  }

  const assignment = await getHotelAssignment(ctx, actor._id)
  const canManageHotel =
    assignment?.role === 'hotel_admin' && assignment.hotelId === hotelId
  const canInviteRole = role === undefined || role === 'hotel_cashier'

  if (!canManageHotel || !canInviteRole) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to manage this invitation.',
    })
  }

  return actor
}

async function getInvitationEmailContext(
  ctx: QueryCtx | MutationCtx,
  invitationId: Id<'hotelStaffInvitations'>,
) {
  const invitation = await ctx.db.get(invitationId)
  if (!invitation) {
    throw new ConvexError({
      code: 'NOT_FOUND',
      message: 'Invitation not found.',
    })
  }

  const [hotel, inviter] = await Promise.all([
    ctx.db.get(invitation.hotelId),
    ctx.db.get(invitation.invitedBy),
  ])
  if (!hotel || hotel.isDeleted) {
    throw new ConvexError({
      code: 'NOT_FOUND',
      message: 'Hotel not found.',
    })
  }

  return {
    invitationId: invitation._id,
    email: invitation.email,
    hotelName: hotel.name,
    hotelCity: hotel.city,
    role: invitation.role,
    invitedByEmail: inviter?.email ?? 'TripWays administrator',
    expiresAt: invitation.expiresAt,
  }
}

// Returns invitation history scoped to the current manager's authority.
export const listScoped = query({
  args: {},
  returns: v.array(invitationListItemValidator),
  handler: async (ctx) => {
    const actor = await requireUser(ctx)
    let invitations

    if (actor.role === 'room_admin') {
      invitations = await ctx.db.query('hotelStaffInvitations').collect()
    } else {
      const assignment = await getHotelAssignment(ctx, actor._id)
      if (!assignment || assignment.role !== 'hotel_admin') {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: 'Only hotel administrators can view invitations.',
        })
      }
      invitations = await ctx.db
        .query('hotelStaffInvitations')
        .withIndex('by_hotel_and_created_at', (q) =>
          q.eq('hotelId', assignment.hotelId),
        )
        .collect()
    }

    const hotelIds = uniqueIds(invitations.map((invite) => invite.hotelId))
    const inviterIds = uniqueIds(invitations.map((invite) => invite.invitedBy))
    const [hotels, inviters] = await Promise.all([
      Promise.all(hotelIds.map((hotelId) => ctx.db.get(hotelId))),
      Promise.all(inviterIds.map((userId) => ctx.db.get(userId))),
    ])
    const hotelMap = new Map(
      hotels
        .filter((hotel) => hotel !== null)
        .map((hotel) => [hotel._id, hotel]),
    )
    const inviterMap = new Map(
      inviters
        .filter((inviter) => inviter !== null)
        .map((inviter) => [inviter._id, inviter]),
    )

    return invitations
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((invitation) => {
        const hotel = hotelMap.get(invitation.hotelId)
        return {
          _id: invitation._id,
          email: invitation.email,
          hotelId: invitation.hotelId,
          hotelName: hotel?.name ?? 'Unknown hotel',
          hotelCity: hotel?.city ?? 'Unknown city',
          role: invitation.role,
          status: getEffectiveStatus(invitation.status, invitation.expiresAt),
          invitedByEmail:
            inviterMap.get(invitation.invitedBy)?.email ?? 'Unknown inviter',
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
          lastSentAt: invitation.lastSentAt,
          deliveryStatus: invitation.deliveryStatus,
          resendCount: invitation.resendCount,
          acceptedAt: invitation.acceptedAt,
          revokedAt: invitation.revokedAt,
        }
      })
  },
})

// Reveals invitation details only to the authenticated, verified recipient.
export const getForRecipient = query({
  args: { invitationId: v.id('hotelStaffInvitations') },
  returns: v.union(invitationListItemValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    await requireUser(ctx)
    const identityEmail =
      typeof identity.email === 'string' ? normalizeEmail(identity.email) : null
    if (identity.emailVerified !== true || identityEmail === null) {
      return null
    }

    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation) return null
    if (identityEmail !== invitation.email) {
      return null
    }

    const [hotel, inviter] = await Promise.all([
      ctx.db.get(invitation.hotelId),
      ctx.db.get(invitation.invitedBy),
    ])
    return {
      _id: invitation._id,
      email: invitation.email,
      hotelId: invitation.hotelId,
      hotelName: hotel?.name ?? 'Unknown hotel',
      hotelCity: hotel?.city ?? 'Unknown city',
      role: invitation.role,
      status: getEffectiveStatus(invitation.status, invitation.expiresAt),
      invitedByEmail: inviter?.email ?? 'Unknown inviter',
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      lastSentAt: invitation.lastSentAt,
      deliveryStatus: invitation.deliveryStatus,
      resendCount: invitation.resendCount,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
    }
  },
})

// Creates an invitation record after enforcing role, hotel, and membership rules.
export const createPending = internalMutation({
  args: {
    email: v.string(),
    hotelId: v.id('hotels'),
    role: hotelStaffRoleValidator,
    tokenHash: v.string(),
  },
  returns: invitationEmailContextValidator,
  handler: async (ctx, args) => {
    const actor = await requireInvitationManager(ctx, args.hotelId, args.role)
    const email = requireValidEmail(args.email)
    const hotel = await ctx.db.get(args.hotelId)
    if (!hotel || hotel.isDeleted) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Hotel not found.',
      })
    }

    const pendingInvitations = await ctx.db
      .query('hotelStaffInvitations')
      .withIndex('by_email', (q) => q.eq('email', email))
      .filter((q) => q.eq(q.field('status'), 'pending'))
      .collect()
    if (pendingInvitations.length > 0) {
      throw new ConvexError({
        code: 'CONFLICT',
        message:
          'This email already has a pending invitation. Resend or revoke it first.',
      })
    }

    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first()
    if (existingUser) {
      const existingAssignment = await getHotelAssignment(ctx, existingUser._id)
      if (existingAssignment) {
        throw new ConvexError({
          code: 'CONFLICT',
          message: 'This user already belongs to a hotel. Unassign them first.',
        })
      }
    }

    const now = Date.now()
    const expiresAt = now + INVITATION_LIFETIME_MS
    const invitationId = await ctx.db.insert('hotelStaffInvitations', {
      email,
      hotelId: args.hotelId,
      role: args.role,
      status: 'pending',
      tokenHash: args.tokenHash,
      invitedBy: actor._id,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      deliveryStatus: 'pending',
      resendCount: 0,
    })

    await createAuditLog(ctx, {
      actorId: actor._id,
      action: 'hotel_staff_invitation_created',
      targetType: 'staff_invitation',
      targetId: invitationId,
      newValue: { email, hotelId: args.hotelId, role: args.role, expiresAt },
    })

    return {
      invitationId,
      email,
      hotelName: hotel.name,
      hotelCity: hotel.city,
      role: args.role,
      invitedByEmail: actor.email,
      expiresAt,
    }
  },
})

// Rotates the bearer secret so every resend invalidates all previous links.
export const rotateForResend = internalMutation({
  args: {
    invitationId: v.id('hotelStaffInvitations'),
    tokenHash: v.string(),
  },
  returns: invitationEmailContextValidator,
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Invitation not found.',
      })
    }
    const actor = await requireInvitationManager(ctx, invitation.hotelId)
    if (invitation.status !== 'pending') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Only pending or expired invitations can be resent.',
      })
    }

    const now = Date.now()
    const expiresAt = now + INVITATION_LIFETIME_MS
    await ctx.db.patch(invitation._id, {
      tokenHash: args.tokenHash,
      expiresAt,
      updatedAt: now,
      deliveryStatus: 'pending',
      latestEmailId: undefined,
      resendCount: invitation.resendCount + 1,
    })

    await createAuditLog(ctx, {
      actorId: actor._id,
      action: 'hotel_staff_invitation_resent',
      targetType: 'staff_invitation',
      targetId: invitation._id,
      metadata: { expiresAt, resendCount: invitation.resendCount + 1 },
    })

    return await getInvitationEmailContext(ctx, invitation._id)
  },
})

// Records the latest enqueue result without overwriting a newer rotated token.
export const markDelivery = internalMutation({
  args: {
    invitationId: v.id('hotelStaffInvitations'),
    tokenHash: v.string(),
    deliveryStatus: v.union(v.literal('queued'), v.literal('failed')),
    emailId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation || invitation.tokenHash !== args.tokenHash) return null
    await ctx.db.patch(invitation._id, {
      deliveryStatus: args.deliveryStatus,
      latestEmailId: args.emailId,
      lastSentAt:
        args.deliveryStatus === 'queued' ? Date.now() : invitation.lastSentAt,
      updatedAt: Date.now(),
    })
    return null
  },
})

// Accepts the invitation and creates the hotel assignment in one transaction.
export const acceptHashed = internalMutation({
  args: {
    invitationId: v.id('hotelStaffInvitations'),
    tokenHash: v.string(),
  },
  returns: v.id('hotelStaff'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const recipient = await requireUser(ctx)
    const identityEmail =
      typeof identity?.email === 'string'
        ? normalizeEmail(identity.email)
        : null
    if (identity?.emailVerified !== true || identityEmail === null) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message:
          'A verified email address is required to accept this invitation.',
      })
    }

    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Invitation not found.',
      })
    }
    if (identityEmail !== invitation.email) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: `This invitation was sent to ${invitation.email}.`,
      })
    }
    if (invitation.status !== 'pending') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'This invitation is no longer pending.',
      })
    }
    if (invitation.expiresAt <= Date.now()) {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message:
          'This invitation has expired. Ask an administrator to resend it.',
      })
    }
    if (invitation.tokenHash !== args.tokenHash) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'This invitation link is invalid or has been replaced.',
      })
    }

    const existingAssignment = await getHotelAssignment(ctx, recipient._id)
    if (existingAssignment) {
      throw new ConvexError({
        code: 'CONFLICT',
        message:
          'You already belong to a hotel. Contact an administrator for help.',
      })
    }
    const hotel = await ctx.db.get(invitation.hotelId)
    if (!hotel || hotel.isDeleted) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Hotel not found.' })
    }

    const now = Date.now()
    const assignmentId = await ctx.db.insert('hotelStaff', {
      userId: recipient._id,
      hotelId: invitation.hotelId,
      role: invitation.role,
      assignedAt: now,
      assignedBy: invitation.invitedBy,
    })
    await ctx.db.patch(invitation._id, {
      status: 'accepted',
      acceptedAt: now,
      acceptedBy: recipient._id,
      updatedAt: now,
    })

    await createAuditLog(ctx, {
      actorId: recipient._id,
      action: 'hotel_staff_invitation_accepted',
      targetType: 'staff_invitation',
      targetId: invitation._id,
      metadata: { assignmentId, invitedBy: invitation.invitedBy },
    })
    await createAuditLog(ctx, {
      actorId: invitation.invitedBy,
      action: 'hotel_staff_assigned',
      targetType: 'user',
      targetId: recipient._id,
      newValue: { hotelId: invitation.hotelId, role: invitation.role },
      metadata: {
        assignmentId,
        invitationId: invitation._id,
        acceptedBy: recipient._id,
      },
    })

    return assignmentId
  },
})

// Revocation preserves history while immediately invalidating the invitation.
export const revoke = mutation({
  args: { invitationId: v.id('hotelStaffInvitations') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Invitation not found.',
      })
    }
    const actor = await requireInvitationManager(ctx, invitation.hotelId)
    if (invitation.status !== 'pending') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Only pending invitations can be revoked.',
      })
    }

    const now = Date.now()
    await ctx.db.patch(invitation._id, {
      status: 'revoked',
      revokedAt: now,
      revokedBy: actor._id,
      updatedAt: now,
    })
    await createAuditLog(ctx, {
      actorId: actor._id,
      action: 'hotel_staff_invitation_revoked',
      targetType: 'staff_invitation',
      targetId: invitation._id,
      previousValue: { status: invitation.status },
      newValue: { status: 'revoked' },
    })
    return null
  },
})
