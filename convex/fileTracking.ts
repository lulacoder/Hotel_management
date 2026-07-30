import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

type ResourceType = 'hotel' | 'room' | 'booking'

export const assign = async (ctx: MutationCtx, args: {
  uploadedBy: Id<'users'>
  storageId: Id<'_storage'>
  resourceType: ResourceType
  resourceId: string
}) => {
  const existing = await ctx.db
    .query('fileUploads')
    .withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId))
    .unique()
  const now = Date.now()

  if (existing) {
    await ctx.db.replace(existing._id, {
      storageId: args.storageId,
      uploadedBy: args.uploadedBy,
      status: 'assigned',
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      uploadedAt: existing.uploadedAt,
      assignedAt: now,
    })
    return
  }

  await ctx.db.insert('fileUploads', {
    storageId: args.storageId,
    uploadedBy: args.uploadedBy,
    status: 'assigned',
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    uploadedAt: now,
    assignedAt: now,
  })
}

export const markDeleted = async (ctx: MutationCtx, args: {
  uploadedBy: Id<'users'>
  storageId: Id<'_storage'>
}) => {
  const existing = await ctx.db
    .query('fileUploads')
    .withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId))
    .unique()
  const now = Date.now()

  if (existing) {
    await ctx.db.replace(existing._id, {
      storageId: args.storageId,
      uploadedBy: args.uploadedBy,
      status: 'deleted',
      uploadedAt: existing.uploadedAt,
      deletedAt: now,
    })
    return
  }

  await ctx.db.insert('fileUploads', {
    storageId: args.storageId,
    uploadedBy: args.uploadedBy,
    status: 'deleted',
    uploadedAt: now,
    deletedAt: now,
  })
}

export const assignR2 = async (ctx: MutationCtx, args: {
  uploadedBy: Id<'users'>
  r2Key: string
  resourceType: ResourceType
  resourceId: string
}) => {
  const existing = await ctx.db
    .query('fileUploads')
    .withIndex('by_r2_key', (q) => q.eq('r2Key', args.r2Key))
    .unique()
  const now = Date.now()

  if (existing) {
    await ctx.db.replace(existing._id, {
      r2Key: args.r2Key,
      uploadedBy: args.uploadedBy,
      status: 'assigned',
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      uploadedAt: existing.uploadedAt,
      assignedAt: now,
    })
    return
  }

  await ctx.db.insert('fileUploads', {
    r2Key: args.r2Key,
    uploadedBy: args.uploadedBy,
    status: 'assigned',
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    uploadedAt: now,
    assignedAt: now,
  })
}

export const markR2Deleted = async (ctx: MutationCtx, args: {
  uploadedBy: Id<'users'>
  r2Key: string
}) => {
  const existing = await ctx.db
    .query('fileUploads')
    .withIndex('by_r2_key', (q) => q.eq('r2Key', args.r2Key))
    .unique()
  const now = Date.now()

  if (existing) {
    await ctx.db.replace(existing._id, {
      r2Key: args.r2Key,
      uploadedBy: args.uploadedBy,
      status: 'deleted',
      uploadedAt: existing.uploadedAt,
      deletedAt: now,
    })
    return
  }

  await ctx.db.insert('fileUploads', {
    r2Key: args.r2Key,
    uploadedBy: args.uploadedBy,
    status: 'deleted',
    uploadedAt: now,
    deletedAt: now,
  })
}
