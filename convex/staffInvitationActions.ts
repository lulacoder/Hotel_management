'use node'

import { createHash, randomBytes } from 'node:crypto'
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { action } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

type InvitationEmailContext = {
  invitationId: Id<'hotelStaffInvitations'>
  email: string
  hotelName: string
  hotelCity: string
  role: 'hotel_admin' | 'hotel_cashier'
  invitedByEmail: string
  expiresAt: number
}

const deliveryResultValidator = v.object({
  invitationId: v.id('hotelStaffInvitations'),
  emailQueued: v.boolean(),
})

function createInvitationSecret() {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  return { token, tokenHash }
}

function hashInvitationSecret(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

// Email delivery is recorded separately so a provider failure never loses the
// pending invitation or tempts the UI to create a duplicate record.
async function enqueueInvitationEmail(
  ctx: ActionCtx,
  context: InvitationEmailContext,
  token: string,
  tokenHash: string,
) {
  try {
    const emailId = await ctx.runMutation(
      internal.staffInvitationEmails.enqueue,
      { ...context, token },
    )
    await ctx.runMutation(internal.staffInvitations.markDelivery, {
      invitationId: context.invitationId,
      tokenHash,
      deliveryStatus: 'queued',
      emailId,
    })
    return true
  } catch (error) {
    console.error('Staff invitation email enqueue failed:', error)
    await ctx.runMutation(internal.staffInvitations.markDelivery, {
      invitationId: context.invitationId,
      tokenHash,
      deliveryStatus: 'failed',
    })
    return false
  }
}

export const create = action({
  args: {
    email: v.string(),
    hotelId: v.id('hotels'),
    role: v.union(v.literal('hotel_admin'), v.literal('hotel_cashier')),
  },
  returns: deliveryResultValidator,
  handler: async (ctx, args) => {
    const { token, tokenHash } = createInvitationSecret()
    const context: InvitationEmailContext = await ctx.runMutation(
      internal.staffInvitations.createPending,
      { ...args, tokenHash },
    )
    const emailQueued = await enqueueInvitationEmail(
      ctx,
      context,
      token,
      tokenHash,
    )
    return { invitationId: context.invitationId, emailQueued }
  },
})

export const resend = action({
  args: { invitationId: v.id('hotelStaffInvitations') },
  returns: deliveryResultValidator,
  handler: async (ctx, args) => {
    const { token, tokenHash } = createInvitationSecret()
    const context: InvitationEmailContext = await ctx.runMutation(
      internal.staffInvitations.rotateForResend,
      { ...args, tokenHash },
    )
    const emailQueued = await enqueueInvitationEmail(
      ctx,
      context,
      token,
      tokenHash,
    )
    return { invitationId: context.invitationId, emailQueued }
  },
})

export const accept = action({
  args: {
    invitationId: v.id('hotelStaffInvitations'),
    token: v.string(),
  },
  returns: v.id('hotelStaff'),
  handler: async (ctx, args): Promise<Id<'hotelStaff'>> => {
    return await ctx.runMutation(internal.staffInvitations.acceptHashed, {
      invitationId: args.invitationId,
      tokenHash: hashInvitationSecret(args.token),
    })
  },
})
