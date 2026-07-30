import { R2 } from '@convex-dev/r2'
import { ConvexError } from 'convex/values'

import { components } from './_generated/api'
import type { DataModel } from './_generated/dataModel'

export const r2 = new R2(components.r2)

export const { generateUploadUrl, syncMetadata, getMetadata } =
  r2.clientApi<DataModel>({
    checkUpload: async (ctx) => {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) {
        throw new ConvexError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated. Please sign in.',
        })
      }
    },
    onUpload: async (ctx, _bucket, key) => {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) {
        throw new ConvexError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated. Please sign in.',
        })
      }

      const user = await ctx.db
        .query('users')
        .withIndex('by_clerk_user_id', (q) =>
          q.eq('clerkUserId', identity.subject),
        )
        .unique()
      if (!user) {
        throw new ConvexError({
          code: 'UNAUTHORIZED',
          message: 'User not found. Please sign in.',
        })
      }

      const existing = await ctx.db
        .query('fileUploads')
        .withIndex('by_r2_key', (q) => q.eq('r2Key', key))
        .unique()
      if (!existing) {
        await ctx.db.insert('fileUploads', {
          r2Key: key,
          uploadedBy: user._id,
          status: 'pending',
          uploadedAt: Date.now(),
        })
      }
    },
  })
