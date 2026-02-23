import { v } from 'convex/values'

import { mutation } from './_generated/server'
import { requireUser } from './lib/auth'

export const generateUploadUrl = mutation({
	args: {
		clerkUserId: v.string(),
	},
	returns: v.string(),
	handler: async (ctx, args) => {
		await requireUser(ctx, args.clerkUserId)
		return await ctx.storage.generateUploadUrl()
	},
})

export const trackUpload = mutation({
	args: {
		clerkUserId: v.string(),
		storageId: v.id('_storage'),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx, args.clerkUserId)

		const existing = await ctx.db
			.query('fileUploads')
			.withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId))
			.unique()

		const now = Date.now()

		if (existing) {
			await ctx.db.replace(existing._id, {
				uploadedBy: user._id,
				storageId: args.storageId,
				status: 'pending',
				uploadedAt: now,
			})
			return null
		}

		await ctx.db.insert('fileUploads', {
			storageId: args.storageId,
			uploadedBy: user._id,
			status: 'pending',
			uploadedAt: now,
		})

		return null
	},
})
