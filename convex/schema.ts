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

  // Hotel staff assignments (hotel-specific roles)
  hotelStaff: defineTable({
    userId: v.id('users'),
    hotelId: v.id('hotels'),
    role: v.union(v.literal('hotel_admin'), v.literal('hotel_cashier')),
    assignedAt: v.number(),
    assignedBy: v.id('users'),
  })
    .index('by_user', ['userId'])
    .index('by_hotel', ['hotelId']),

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
    // New fields for hotel data import
    externalId: v.optional(v.string()), // Original HotelId from JSON
    description: v.optional(v.string()), // Hotel description
    category: v.optional(
      v.union(
        v.literal('Boutique'),
        v.literal('Budget'),
        v.literal('Luxury'),
        v.literal('Resort and Spa'),
        v.literal('Extended-Stay'),
        v.literal('Suite'),
      ),
    ),
    tags: v.optional(v.array(v.string())), // ["pool", "free wifi", etc.]
    parkingIncluded: v.optional(v.boolean()),
    rating: v.optional(v.number()), // 1.0-5.0
    stateProvince: v.optional(v.string()), // "NY", "CA", etc.
    postalCode: v.optional(v.string()),
    lastRenovationDate: v.optional(v.string()), // "YYYY-MM-DD" format
    metadata: v.optional(v.record(v.string(), v.any())),
    isDeleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_city', ['city'])
    .index('by_country', ['country'])
    .index('by_is_deleted', ['isDeleted'])
    .index('by_category', ['category'])
    .index('by_external_id', ['externalId'])
    .searchIndex('search_name', {
      searchField: 'name',
      filterFields: ['city', 'isDeleted', 'category'],
    }),

  // Rooms table
  rooms: defineTable({
    hotelId: v.id('hotels'),
    roomNumber: v.string(),
    type: v.union(
      v.literal('budget'),
      v.literal('standard'),
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
    // New fields for room data import
    description: v.optional(v.string()), // "Suite, 2 Queen Beds (Mountain View)"
    bedOptions: v.optional(v.string()), // "2 Queen Beds", "1 King Bed"
    smokingAllowed: v.optional(v.boolean()),
    isDeleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_hotel', ['hotelId'])
    .index('by_hotel_and_status', ['hotelId', 'operationalStatus'])
    .index('by_hotel_and_room_number', ['hotelId', 'roomNumber'])
    .index('by_hotel_and_is_deleted', ['hotelId', 'isDeleted'])
    .index('by_hotel_and_type', ['hotelId', 'type']),

  // Guest profiles for walk-in guests
  guestProfiles: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    linkedUserId: v.optional(v.id('users')),
  })
    .index('by_phone', ['phone'])
    .index('by_email', ['email'])
    .index('by_linked_user', ['linkedUserId']),

  // Bookings table
  bookings: defineTable({
    userId: v.optional(v.id('users')),
    guestProfileId: v.optional(v.id('guestProfiles')),
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
      v.literal('outsourced'),
    ),
    holdExpiresAt: v.optional(v.number()), // Timestamp for hold expiration
    outsourcedToHotelId: v.optional(v.id('hotels')),
    outsourcedAt: v.optional(v.number()),
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
    packageType: v.optional(
      v.union(
        v.literal('room_only'),
        v.literal('with_breakfast'),
        v.literal('full_package'),
      ),
    ),
    packageAddOn: v.optional(v.number()), // In cents, snapshot per night
    guestName: v.optional(v.string()),
    guestEmail: v.optional(v.string()),
    specialRequests: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id('users')),
  })
    .index('by_room', ['roomId'])
    .index('by_user', ['userId'])
    .index('by_guest_profile', ['guestProfileId'])
    .index('by_status', ['status'])
    .index('by_hotel', ['hotelId'])
    .index('by_room_and_status', ['roomId', 'status'])
    .index('by_room_and_dates', ['roomId', 'checkIn', 'checkOut'])
    .index('by_hold_expires', ['holdExpiresAt']),

  // Hotel ratings table
  hotelRatings: defineTable({
    hotelId: v.id('hotels'),
    userId: v.id('users'),
    rating: v.number(), // 1-5
    review: v.optional(v.string()),
    isDeleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_hotel', ['hotelId'])
    .index('by_user', ['userId'])
    .index('by_user_and_hotel', ['userId', 'hotelId'])
    .index('by_hotel_and_is_deleted', ['hotelId', 'isDeleted']),

  // Audit events table for tracking changes
  auditEvents: defineTable({
    actorId: v.id('users'),
    action: v.string(),
    targetType: v.union(
      v.literal('hotel'),
      v.literal('room'),
      v.literal('booking'),
      v.literal('rating'),
      v.literal('user'),
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
