import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
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

const MAX_UNREAD_BADGE_COUNT = 99

// Maps a notification type + message to the push title/body shown on the
// device's notification tray. Returns null when no push should be sent
// (staff-only types; the customer-facing mobile app doesn't surface these).
function mapNotificationToPush(
  type:
    | 'booking_payment_proof_submitted'
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'booking_payment_rejected',
  message: string,
): { title: string; body: string } | null {
  switch (type) {
    case 'booking_confirmed':
      return { title: 'Booking confirmed', body: message }
    case 'booking_cancelled':
      return { title: 'Booking cancelled', body: message }
    case 'booking_payment_rejected':
      return { title: 'Payment needs attention', body: message }
    case 'booking_payment_proof_submitted':
      return null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Returns all notifications for the authenticated user, newest first.
export const getMyNotifications = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(notificationValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    return await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .paginate(args.paginationOpts)
  },
})

// Returns the count of unread notifications for the authenticated user.
export const getUnreadCount = query({
  args: {},
  returns: v.object({
    count: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx)

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_is_read', (q) =>
        q.eq('userId', user._id).eq('isRead', false),
      )
      .take(MAX_UNREAD_BADGE_COUNT + 1)

    return {
      count: Math.min(unread.length, MAX_UNREAD_BADGE_COUNT),
      hasMore: unread.length > MAX_UNREAD_BADGE_COUNT,
    }
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
// Also schedules an Expo push for notification types that have a push mapping.
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
    const notificationId = await ctx.db.insert('notifications', {
      userId: args.userId,
      type: args.type,
      bookingId: args.bookingId,
      hotelId: args.hotelId,
      message: args.message,
      isRead: false,
      createdAt: Date.now(),
    })

    const push = mapNotificationToPush(args.type, args.message)
    if (push) {
      await ctx.scheduler.runAfter(0, internal.push.sendExpoPush, {
        userId: args.userId,
        title: push.title,
        body: push.body,
        data: { bookingId: args.bookingId, type: args.type },
      })
    }

    return notificationId
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
