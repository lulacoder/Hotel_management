import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getHotelAssignment, requireUser } from './lib/auth'

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export const priorityValidator = v.union(
  v.literal('normal'),
  v.literal('important'),
  v.literal('urgent'),
)

const announcementValidator = v.object({
  _id: v.id('announcements'),
  _creationTime: v.number(),
  hotelId: v.id('hotels'),
  createdBy: v.id('users'),
  title: v.string(),
  body: v.string(),
  priority: priorityValidator,
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  updatedBy: v.optional(v.id('users')),
})

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function requireAnnouncementAccess(
  ctx: Parameters<typeof requireUser>[0],
) {
  const user = await requireUser(ctx)
  const assignment = await getHotelAssignment(ctx, user._id)

  if (
    !assignment ||
    !(['hotel_admin', 'hotel_cashier'] as Array<string>).includes(
      assignment.role,
    )
  ) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message:
        'Only assigned hotel admins and cashiers can manage announcements.',
    })
  }

  return { user, assignment }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Returns ALL announcements (active + inactive) for the staff member's hotel.
// Used by the admin management view.
export const getHotelAnnouncements = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('announcements'),
      _creationTime: v.number(),
      hotelId: v.id('hotels'),
      createdBy: v.id('users'),
      title: v.string(),
      body: v.string(),
      priority: priorityValidator,
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      updatedBy: v.optional(v.id('users')),
      createdByEmail: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const { assignment } = await requireAnnouncementAccess(ctx)

    const announcements = await ctx.db
      .query('announcements')
      .withIndex('by_hotel_and_created_at', (q) =>
        q.eq('hotelId', assignment.hotelId),
      )
      .order('desc')
      .collect()

    const result = []
    for (const ann of announcements) {
      const creator = await ctx.db.get(ann.createdBy)
      result.push({
        ...ann,
        createdByEmail: creator?.email ?? 'Unknown',
      })
    }

    return result
  },
})

// Returns only ACTIVE announcements for a hotel. Public — no auth required.
// Used by the customer-facing announcements view.
export const getActiveAnnouncementsForHotel = query({
  args: { hotelId: v.id('hotels') },
  returns: v.array(announcementValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('announcements')
      .withIndex('by_hotel_and_is_active', (q) =>
        q.eq('hotelId', args.hotelId).eq('isActive', true),
      )
      .order('desc')
      .collect()
  },
})

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

// Creates a new announcement for the staff member's hotel.
// Defaults to isActive: true so it's immediately visible to customers.
export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    priority: priorityValidator,
  },
  returns: v.id('announcements'),
  handler: async (ctx, args) => {
    const { user, assignment } = await requireAnnouncementAccess(ctx)

    const title = args.title.trim()
    const body = args.body.trim()

    if (title.length < 3 || title.length > 120) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Title must be between 3 and 120 characters.',
      })
    }
    if (body.length < 10 || body.length > 2000) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Body must be between 10 and 2000 characters.',
      })
    }

    const now = Date.now()
    return await ctx.db.insert('announcements', {
      hotelId: assignment.hotelId,
      createdBy: user._id,
      title,
      body,
      priority: args.priority,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Updates the title, body, and priority of an existing announcement.
// Caller must be staff of the same hotel.
export const update = mutation({
  args: {
    announcementId: v.id('announcements'),
    title: v.string(),
    body: v.string(),
    priority: priorityValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, assignment } = await requireAnnouncementAccess(ctx)

    const announcement = await ctx.db.get(args.announcementId)
    if (!announcement) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Announcement not found.',
      })
    }
    if (announcement.hotelId !== assignment.hotelId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You can only edit announcements for your own hotel.',
      })
    }

    const title = args.title.trim()
    const body = args.body.trim()

    if (title.length < 3 || title.length > 120) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Title must be between 3 and 120 characters.',
      })
    }
    if (body.length < 10 || body.length > 2000) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Body must be between 10 and 2000 characters.',
      })
    }

    await ctx.db.patch(args.announcementId, {
      title,
      body,
      priority: args.priority,
      updatedAt: Date.now(),
      updatedBy: user._id,
    })

    return null
  },
})

// Flips the isActive flag. Inactive announcements are hidden from customers.
export const toggleActive = mutation({
  args: { announcementId: v.id('announcements') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, assignment } = await requireAnnouncementAccess(ctx)

    const announcement = await ctx.db.get(args.announcementId)
    if (!announcement) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Announcement not found.',
      })
    }
    if (announcement.hotelId !== assignment.hotelId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You can only modify announcements for your own hotel.',
      })
    }

    await ctx.db.patch(args.announcementId, {
      isActive: !announcement.isActive,
      updatedAt: Date.now(),
      updatedBy: user._id,
    })

    return null
  },
})

// Hard-deletes an announcement. Caller must be staff of the same hotel.
export const remove = mutation({
  args: { announcementId: v.id('announcements') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { assignment } = await requireAnnouncementAccess(ctx)

    const announcement = await ctx.db.get(args.announcementId)
    if (!announcement) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Announcement not found.',
      })
    }
    if (announcement.hotelId !== assignment.hotelId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You can only delete announcements for your own hotel.',
      })
    }

    await ctx.db.delete(args.announcementId)

    return null
  },
})
