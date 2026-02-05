import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Users table for role-based authentication
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    role: v.union(v.literal('customer'), v.literal('room_admin')),
    createdAt: v.number(),
  })
    .index('by_clerk_user_id', ['clerkUserId'])
    .index('by_email', ['email'])
    .index('by_role', ['role']),

  // Hotels table
  hotels: defineTable({
    name: v.string(),
    address: v.string(),
    city: v.string(),
    country: v.string(),
    location: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
      }),
    ),
    metadata: v.optional(v.record(v.string(), v.any())),
    isDeleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_city', ['city'])
    .index('by_country', ['country'])
    .index('by_is_deleted', ['isDeleted'])
    .searchIndex('search_name', {
      searchField: 'name',
      filterFields: ['city', 'isDeleted'],
    }),

  // Rooms table
  rooms: defineTable({
    hotelId: v.id('hotels'),
    roomNumber: v.string(),
    type: v.union(
      v.literal('single'),
      v.literal('double'),
      v.literal('suite'),
      v.literal('deluxe'),
    ),
    basePrice: v.number(), // In cents
    maxOccupancy: v.number(),
    operationalStatus: v.union(
      v.literal('available'),
      v.literal('maintenance'),
      v.literal('cleaning'),
      v.literal('out_of_order'),
    ),
    amenities: v.optional(v.array(v.string())),
    isDeleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_hotel', ['hotelId'])
    .index('by_hotel_and_status', ['hotelId', 'operationalStatus'])
    .index('by_hotel_and_room_number', ['hotelId', 'roomNumber'])
    .index('by_hotel_and_is_deleted', ['hotelId', 'isDeleted']),

  // Bookings table
  bookings: defineTable({
    userId: v.id('users'),
    roomId: v.id('rooms'),
    hotelId: v.id('hotels'), // Denormalized for efficient queries
    checkIn: v.string(), // YYYY-MM-DD format
    checkOut: v.string(), // YYYY-MM-DD format
    status: v.union(
      v.literal('held'),
      v.literal('confirmed'),
      v.literal('checked_in'),
      v.literal('checked_out'),
      v.literal('cancelled'),
      v.literal('expired'),
    ),
    holdExpiresAt: v.optional(v.number()), // Timestamp for hold expiration
    paymentStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('paid'),
        v.literal('failed'),
        v.literal('refunded'),
      ),
    ),
    pricePerNight: v.number(), // In cents, snapshot at booking time
    totalPrice: v.number(), // In cents
    guestName: v.optional(v.string()),
    guestEmail: v.optional(v.string()),
    specialRequests: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id('users')),
  })
    .index('by_room', ['roomId'])
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_hotel', ['hotelId'])
    .index('by_room_and_status', ['roomId', 'status'])
    .index('by_room_and_dates', ['roomId', 'checkIn', 'checkOut'])
    .index('by_hold_expires', ['holdExpiresAt']),

  // Audit events table for tracking changes
  auditEvents: defineTable({
    actorId: v.id('users'),
    action: v.string(),
    targetType: v.union(
      v.literal('hotel'),
      v.literal('room'),
      v.literal('booking'),
    ),
    targetId: v.string(), // Generic ID stored as string
    previousValue: v.optional(v.string()), // JSON stringified
    newValue: v.optional(v.string()), // JSON stringified
    metadata: v.optional(v.record(v.string(), v.any())),
    timestamp: v.number(),
  })
    .index('by_actor', ['actorId'])
    .index('by_target', ['targetType', 'targetId'])
    .index('by_timestamp', ['timestamp']),
})
