'use node'

import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { Webhook } from 'svix'

interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses?: Array<{ email_address: string }>
    public_metadata?: { role?: string }
  }
}

export const verifyAndProcessWebhook = internalAction({
  args: {
    body: v.string(),
    svixId: v.string(),
    svixTimestamp: v.string(),
    svixSignature: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error('CLERK_WEBHOOK_SECRET not set')
    }

    const wh = new Webhook(webhookSecret)

    // Verify the webhook signature
    const event = wh.verify(args.body, {
      'svix-id': args.svixId,
      'svix-timestamp': args.svixTimestamp,
      'svix-signature': args.svixSignature,
    }) as ClerkWebhookEvent

    if (event.type === 'user.created') {
      const { id, email_addresses, public_metadata } = event.data
      const email = email_addresses?.[0]?.email_address ?? ''

      // Detect role from public_metadata (set in Clerk Dashboard for admins)
      const role =
        public_metadata?.role === 'room_admin' ? 'room_admin' : 'customer'

      await ctx.runMutation(internal.users.createUser, {
        clerkUserId: id,
        email,
        role,
      })

      console.log(`Created user ${id} with role ${role}`)
    }

    return null
  },
})
