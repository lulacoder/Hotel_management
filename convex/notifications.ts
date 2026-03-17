import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { requireUser } from './lib/auth'

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const notificationTypeValidator = v.union(
  v.literal('booking_payment_proof_submitted'),
  v.literal('booking_confirmed'),
  v.literal('booking_cancelled'),
  v.literal('booking_payment_rejected'),
)

const notificationValidator = v.object({
  _id: v.id('notifications'),
  _creationTime: v.number(),
  userId: v.id('users'),
  type: notificationTypeValidator,
  bookingId: v.id('bookings'),
  hotelId: v.id('hotels'),
  message: v.string(),
  isRead: v.boolean(),
  createdAt: v.number(),
})

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Returns all notifications for the authenticated user, newest first.
export const getMyNotifications = query({
  args: {},
  returns: v.array(notificationValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx)

    return await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect()
  },
})

// Returns the count of unread notifications for the authenticated user.
export const getUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireUser(ctx)

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_is_read', (q) =>
        q.eq('userId', user._id).eq('isRead', false),
      )
      .collect()

    return unread.length
  },
})

// ---------------------------------------------------------------------------
// Public Mutations
// ---------------------------------------------------------------------------

// Marks a single notification as read. Only the owner can mark it.
export const markAsRead = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const notification = await ctx.db.get(args.notificationId)
    if (!notification) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Notification not found.',
      })
    }

    if (notification.userId !== user._id) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You can only mark your own notifications as read.',
      })
    }

    if (!notification.isRead) {
      await ctx.db.patch(args.notificationId, { isRead: true })
    }

    return null
  },
})

// Marks all of the authenticated user's notifications as read.
export const markAllAsRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx)

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_is_read', (q) =>
        q.eq('userId', user._id).eq('isRead', false),
      )
      .collect()

    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { isRead: true })))

    return null
  },
})

// Deletes all notifications for the authenticated user.
export const clearAll = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx)

    const all = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    await Promise.all(all.map((n) => ctx.db.delete(n._id)))

    return null
  },
})

// ---------------------------------------------------------------------------
// Internal Mutations (called from other Convex functions only)
// ---------------------------------------------------------------------------

// Creates a single notification record. Called from booking mutations.
export const createNotification = internalMutation({
  args: {
    userId: v.id('users'),
    type: notificationTypeValidator,
    bookingId: v.id('bookings'),
    hotelId: v.id('hotels'),
    message: v.string(),
  },
  returns: v.id('notifications'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('notifications', {
      userId: args.userId,
      type: args.type,
      bookingId: args.bookingId,
      hotelId: args.hotelId,
      message: args.message,
      isRead: false,
      createdAt: Date.now(),
    })
  },
})

// Creates notifications for every hotel staff member at a given hotel.
// Used to fan-out a single booking event to all relevant staff.
export const notifyHotelStaff = internalMutation({
  args: {
    hotelId: v.id('hotels'),
    type: notificationTypeValidator,
    bookingId: v.id('bookings'),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staffMembers = await ctx.db
      .query('hotelStaff')
      .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
      .collect()

    const now = Date.now()

    await Promise.all(
      staffMembers.map((staff) =>
        ctx.db.insert('notifications', {
          userId: staff.userId,
          type: args.type,
          bookingId: args.bookingId,
          hotelId: args.hotelId,
          message: args.message,
          isRead: false,
          createdAt: now,
        }),
      ),
    )

    return null
  },
})
