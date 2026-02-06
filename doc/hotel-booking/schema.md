# Database Schema

This document describes all database tables in the hotel booking system. Understanding this schema is key to working with the codebase.

## Tables Overview

| Table         | Purpose                    |
| ------------- | -------------------------- |
| `users`       | User profiles with roles   |
| `hotels`      | Hotel properties           |
| `rooms`       | Rooms within hotels        |
| `bookings`    | Customer reservations      |
| `auditEvents` | Action history/audit trail |

## Detailed Schema

### users

Stores user profiles linked to Clerk authentication.

```typescript
users: defineTable({
  clerkUserId: v.string(), // Clerk's user ID (links to auth)
  email: v.string(),
  role: v.union(
    v.literal('room_admin'), // Can manage hotels/rooms
    v.literal('customer'), // Can browse and book
  ),
  createdAt: v.number(), // Unix timestamp (ms)
  updatedAt: v.number(),
}).index('by_clerk_id', ['clerkUserId']) // Fast lookup by Clerk ID
```

**How it's used:**

- Created automatically when user signs up (via Clerk webhook)
- Queried on every authenticated request to check role
- Role determines which UI and API functions are accessible

### hotels

Stores hotel properties.

```typescript
hotels: defineTable({
  name: v.string(),
  address: v.string(),
  city: v.string(),
  country: v.string(),
  isDeleted: v.boolean(), // Soft delete flag
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.id('users'), // Admin who created it
  updatedBy: v.optional(v.id('users')),

  // Extended fields (all optional)
  externalId: v.optional(v.string()), // Original ID from imported data
  description: v.optional(v.string()), // Hotel description
  category: v.optional(
    v.union(
      // Hotel type
      v.literal('Boutique'),
      v.literal('Budget'),
      v.literal('Luxury'),
      v.literal('Resort and Spa'),
      v.literal('Extended-Stay'),
      v.literal('Suite'),
    ),
  ),
  tags: v.optional(v.array(v.string())), // ["pool", "wifi", "gym", etc.]
  parkingIncluded: v.optional(v.boolean()), // Free parking available
  rating: v.optional(v.number()), // 1.0 - 5.0
  stateProvince: v.optional(v.string()), // "NY", "CA", etc.
  postalCode: v.optional(v.string()), // "10022"
  lastRenovationDate: v.optional(v.string()), // "YYYY-MM-DD" format
  location: v.optional(
    v.object({
      // Geo coordinates for distance calc
      lat: v.number(),
      lng: v.number(),
    }),
  ),
})
  .index('by_city', ['city'])
  .index('by_country', ['country'])
  .index('by_category', ['category']) // Filter by hotel type
  .index('by_external_id', ['externalId']) // Lookup by source ID
  .searchIndex('search_name', {
    searchField: 'name',
    filterFields: ['category', 'city', 'isDeleted'],
  })
```

**Key points:**

- `isDeleted` enables soft delete (preserves booking history)
- Search index allows fuzzy name matching with filters
- City/country/category indexes support filtering
- `location` enables distance-based sorting
- `externalId` prevents duplicate imports

### rooms

Stores rooms within hotels.

```typescript
rooms: defineTable({
  hotelId: v.id('hotels'), // Parent hotel
  roomNumber: v.string(), // "101", "202A", etc.
  type: v.union(
    v.literal('budget'), // Economy rooms
    v.literal('standard'), // Standard rooms
    v.literal('suite'),
    v.literal('deluxe'),
  ),
  maxOccupancy: v.number(), // Max guests
  basePrice: v.number(), // Price per night in CENTS
  amenities: v.optional(v.array(v.string())), // ["WiFi", "TV", "Air Conditioning", etc.]
  operationalStatus: v.union(
    v.literal('available'), // Can be booked
    v.literal('maintenance'), // Temporarily unavailable
    v.literal('out_of_service'), // Long-term unavailable
  ),
  isDeleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.id('users'),
  updatedBy: v.optional(v.id('users')),

  // Extended fields (all optional)
  description: v.optional(v.string()), // "Budget Room, 1 Queen Bed (Cityside)"
  bedOptions: v.optional(v.string()), // "1 King Bed", "2 Queen Beds"
  smokingAllowed: v.optional(v.boolean()), // Smoking policy
})
  .index('by_hotel', ['hotelId'])
  .index('by_type', ['type'])
  .index('by_status', ['operationalStatus'])
  .index('by_hotel_and_type', ['hotelId', 'type']) // Filter rooms by type within hotel
```

**Key points:**

- Prices are in CENTS (not dollars) to avoid floating-point issues
- `operationalStatus` controls whether room can be booked
- Amenities are stored as string array for flexibility
- Room types: `budget`, `standard`, `suite`, `deluxe`
- `description` provides detailed room info
- `bedOptions` specifies bed configuration

### bookings

The heart of the system - stores all reservations.

```typescript
bookings: defineTable({
  userId: v.id('users'), // Customer who booked
  roomId: v.id('rooms'),
  hotelId: v.id('hotels'), // Denormalized for efficient queries
  checkIn: v.string(), // "YYYY-MM-DD" format
  checkOut: v.string(),
  status: v.union(
    v.literal('held'), // Temporary hold (15 min)
    v.literal('confirmed'), // Payment accepted
    v.literal('checked_in'),
    v.literal('checked_out'),
    v.literal('cancelled'),
    v.literal('expired'), // Hold timed out
  ),
  holdExpiresAt: v.optional(v.number()), // When hold expires
  paymentStatus: v.optional(
    v.union(
      v.literal('pending'),
      v.literal('paid'),
      v.literal('failed'),
      v.literal('refunded'),
    ),
  ),
  pricePerNight: v.number(), // Snapshot at booking time
  totalPrice: v.number(), // pricePerNight * nights
  guestName: v.optional(v.string()),
  guestEmail: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  updatedBy: v.optional(v.id('users')),
})
  .index('by_user', ['userId'])
  .index('by_room', ['roomId'])
  .index('by_hotel', ['hotelId'])
  .index('by_status', ['status'])
  .index('by_room_and_dates', ['roomId', 'checkIn', 'checkOut'])
```

**Key design decisions:**

1. **`hotelId` is denormalized** - We store it even though we could derive it from `roomId`. This makes hotel-level queries faster.

2. **Dates are strings** - "YYYY-MM-DD" format is timezone-agnostic and sorts correctly.

3. **Prices are snapshots** - We store the price at booking time, not a reference. This protects against retroactive price changes.

4. **Hold expiration** - The `holdExpiresAt` field enables the "hold for 15 minutes" feature.

### auditEvents
 
Tracks all significant actions for debugging and compliance.

```typescript
auditEvents: defineTable({
  actorId: v.id('users'), // Who did it
  action: v.string(), // "booking_created", "room_updated", etc.
  targetType: v.string(), // "booking", "room", "hotel"
  targetId: v.string(), // ID of affected record
  previousValue: v.optional(v.string()), // JSON-stringified old value
  newValue: v.optional(v.string()), // JSON-stringified new value
  metadata: v.optional(v.string()), // Extra context (e.g., reason)
  createdAt: v.number(),
})
  .index('by_target', ['targetType', 'targetId'])
  .index('by_actor', ['actorId'])
  .index('by_action', ['action'])
```

**What gets logged:**

- Booking created, confirmed, cancelled, expired
- Room created, updated, status changed, deleted
- Hotel created, updated, deleted

## Index Strategy

Indexes are critical for performance. Here's why each one exists:

| Index                        | Purpose                                 |
| ---------------------------- | --------------------------------------- |
| `users.by_clerk_id`          | Auth lookup on every request            |
| `hotels.by_city/country`     | Location-based filtering                |
| `hotels.by_category`         | Filter by hotel type                    |
| `hotels.by_external_id`      | Lookup imported hotels by source ID     |
| `hotels.search_name`         | Fuzzy search with category/city filters |
| `rooms.by_hotel`             | List rooms for a hotel                  |
| `rooms.by_status`            | Filter available rooms                  |
| `rooms.by_hotel_and_type`    | Filter rooms by type within hotel       |
| `bookings.by_user`           | "My bookings" query                     |
| `bookings.by_room`           | Availability checking                   |
| `bookings.by_hotel`          | Admin: bookings per hotel               |
| `bookings.by_room_and_dates` | Overlap detection                       |

## Common Patterns

### Checking Room Availability

```typescript
// Get all bookings for this room
const bookings = await ctx.db
  .query('bookings')
  .withIndex('by_room', (q) => q.eq('roomId', roomId))
  .collect()

// Filter to active bookings and check for overlap
const hasConflict = bookings.some((booking) => {
  if (['cancelled', 'expired', 'checked_out'].includes(booking.status)) {
    return false // Ignore these
  }
  return datesOverlap(requested, booking)
})
```

### Soft Delete

```typescript
// "Delete" a hotel (soft)
await ctx.db.patch(hotelId, {
  isDeleted: true,
  updatedAt: Date.now(),
})

// Query only active hotels
const hotels = (await ctx.db.query('hotels').collect()).filter(
  (h) => !h.isDeleted,
)
```

### Audit Logging

```typescript
await createAuditLog(ctx, {
  actorId: user._id,
  action: 'booking_confirmed',
  targetType: 'booking',
  targetId: bookingId,
  previousValue: { status: 'held' },
  newValue: { status: 'confirmed' },
})
```

## Schema File Location

The full schema is defined in: [convex/schema.ts](../../convex/schema.ts)
