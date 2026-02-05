# Admin Flow

This document covers everything an admin can do: managing hotels, rooms, and viewing bookings.

## Getting Admin Access

Users with `role: "room_admin"` in the Convex `users` table get admin access.

**To make yourself an admin (for testing):**

1. Sign up as a regular user
2. Open Convex Dashboard (https://dashboard.convex.dev)
3. Go to your deployment → Data → users table
4. Find your user and change `role` from `"customer"` to `"room_admin"`
5. Refresh the app - you'll be redirected to `/admin`

## Admin Layout

**Route:** `/admin` ([src/routes/admin.tsx](../../src/routes/admin.tsx))

The admin area has a persistent sidebar layout:

- **Sidebar** (left): Navigation links
- **Main content** (right): Changes based on route

**Navigation items:**

- Dashboard (`/admin`)
- Hotels (`/admin/hotels`)
- Rooms (`/admin/rooms`)
- Bookings (`/admin/bookings`)

## Dashboard

**Route:** `/admin` ([src/routes/admin/index.tsx](../../src/routes/admin/index.tsx))

**What admin sees:**

- Welcome message with user's name
- Quick stats (total hotels, rooms, bookings)
- Recent activity summary
- Quick action buttons

## Hotel Management

### Hotels List

**Route:** `/admin/hotels` ([src/routes/admin/hotels/index.tsx](../../src/routes/admin/hotels/index.tsx))

**Features:**

- Grid of hotel cards
- Search bar (filters by name, city, country)
- "Add Hotel" button
- Each card has a dropdown menu:
  - View Details
  - Edit Hotel
  - Delete Hotel

**Backend queries/mutations:**

```typescript
// List all hotels (includes deleted for admin)
const hotels = useQuery(api.hotels.list, {})

// Delete (soft) a hotel
await deleteHotel({
  clerkUserId: user.id,
  hotelId: hotel._id,
})
```

### Create/Edit Hotel Modal

**Triggered by:** "Add Hotel" button or "Edit" menu option

**Form fields:**

- Hotel Name (required)
- Address (required)
- City (required)
- Country (required)

**Backend mutations:**

```typescript
// Create new hotel
await createHotel({
  clerkUserId: user.id,
  name: 'Grand Plaza',
  address: '123 Main St',
  city: 'New York',
  country: 'USA',
})

// Update existing hotel
await updateHotel({
  clerkUserId: user.id,
  hotelId: hotel._id,
  name: 'Grand Plaza Hotel',
  // ... other fields
})
```

### Hotel Detail Page

**Route:** `/admin/hotels/$hotelId` ([src/routes/admin/hotels/$hotelId.tsx](../../src/routes/admin/hotels/$hotelId.tsx))

This is where you manage a specific hotel's rooms.

**What admin sees:**

- Hotel info header (name, location)
- "Back to Hotels" link
- "Add Room" button
- List of rooms with:
  - Room number and type
  - Capacity and price
  - Amenities
  - Status badge
  - Action buttons (Edit, Change Status, Delete)

## Room Management

### Rooms Overview

**Route:** `/admin/rooms` ([src/routes/admin/rooms/index.tsx](../../src/routes/admin/rooms/index.tsx))

This page lists all hotels and links to their room management. It's a convenience route that redirects to the hotel detail page.

### Create Room

**Triggered by:** "Add Room" button on hotel detail page

**Form fields:**

- Room Number (required) - e.g., "101", "Suite A"
- Room Type (required) - Single, Double, Suite, Deluxe
- Capacity (required) - Number of guests
- Price per Night (required) - In dollars (converted to cents on save)
- Amenities (optional) - Multi-select: WiFi, TV, AC, Mini Bar

**Backend mutation:**

```typescript
await createRoom({
  clerkUserId: user.id,
  hotelId: hotel._id,
  roomNumber: '101',
  type: 'double',
  capacity: 2,
  basePrice: 15000, // $150.00 in cents
  amenities: ['wifi', 'tv', 'ac'],
})
```

**Validation:**

- Room number must be unique within the hotel
- Capacity must be at least 1
- Price must be positive

### Edit Room

**Triggered by:** "Edit" button on room card

Same form as create, pre-populated with current values.

**Backend mutation:**

```typescript
await updateRoom({
  clerkUserId: user.id,
  roomId: room._id,
  roomNumber: '101A',
  basePrice: 17500, // Price increase
  // ... other fields
})
```

### Change Room Status

**Triggered by:** "Change Status" button on room card

**Available statuses:**

- **Available** - Room can be booked
- **Maintenance** - Temporarily unavailable (e.g., repairs)
- **Out of Service** - Long-term unavailable

**Backend mutation:**

```typescript
await updateRoomStatus({
  clerkUserId: user.id,
  roomId: room._id,
  status: 'maintenance',
})
```

**Important:** Changing status to maintenance/out_of_service does NOT automatically cancel existing bookings. The admin should review and handle those separately.

### Delete Room

**Triggered by:** "Delete" button on room card

**Confirmation:** "Are you sure? This cannot be undone."

Actually, it CAN be undone - we use soft delete! The room gets `isDeleted: true` but remains in the database.

**Backend mutation:**

```typescript
await softDeleteRoom({
  clerkUserId: user.id,
  roomId: room._id,
})
```

## Booking Management

### Bookings List

**Route:** `/admin/bookings` ([src/routes/admin/bookings/index.tsx](../../src/routes/admin/bookings/index.tsx))

**Features:**

- Hotel dropdown filter (required to view bookings)
- Status filter (All, Held, Confirmed, etc.)
- List of bookings with:
  - Status badge with icon
  - Guest name and dates
  - Total price
  - Payment status
  - Hold expiration (if applicable)
  - Cancel button (for held/confirmed)

**Backend query:**

```typescript
// Get bookings for a specific hotel
const bookings = useQuery(api.bookings.getByHotel, {
  clerkUserId: user.id,
  hotelId: selectedHotel,
  status: 'confirmed', // Optional filter
})
```

### Cancel Booking (Admin)

Admins can cancel any booking (not just their own).

**Backend mutation:**

```typescript
await cancelBooking({
  clerkUserId: user.id,
  bookingId: booking._id,
  reason: 'Customer requested via phone',
})
```

The reason is stored in the audit log for reference.

## Authorization & Security

All admin operations are protected on the backend:

```typescript
// In convex/lib/auth.ts

export async function requireAdmin(ctx, clerkUserId) {
  const user = await requireUser(ctx, clerkUserId)
  if (user.role !== 'room_admin') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Admin access required.',
    })
  }
  return user
}
```

Every admin mutation calls `requireAdmin()` at the start. This means:

- Even if someone manually calls the API, they'll be blocked
- Role checks happen on every request (not just at login)
- The frontend role checks are just for UX (hiding admin UI from customers)

## Audit Trail

Every admin action is logged:

| Action              | Logged Data             |
| ------------------- | ----------------------- |
| Hotel created       | Hotel details           |
| Hotel updated       | Old vs new values       |
| Hotel deleted       | Deletion timestamp      |
| Room created        | Room details            |
| Room updated        | Old vs new values       |
| Room status changed | Old vs new status       |
| Room deleted        | Deletion timestamp      |
| Booking cancelled   | Previous status, reason |

**Viewing audit logs:**

Currently, there's no UI for audit logs. You can view them in the Convex Dashboard under the `auditEvents` table.

Future enhancement: Add an audit log viewer in the admin UI.

## Common Admin Tasks

### "Room shows as available but customer can't book"

Check:

1. Room's `operationalStatus` - must be `available`
2. Room's `isDeleted` - must be `false`
3. Existing bookings - look for held/confirmed bookings on those dates

### "Customer's hold expired, need to rebook"

The customer needs to create a new booking. Expired holds cannot be restored - this is by design to prevent gaming the system.

### "Need to block a room for renovation"

1. Go to Hotel Detail page
2. Find the room
3. Click "Change Status" → "Out of Service"
4. The room will no longer appear in customer searches

### "Customer called to cancel"

1. Go to Bookings page
2. Select the hotel
3. Find the booking
4. Click "Cancel"
5. Enter a reason (e.g., "Customer called to cancel")

The cancellation is logged with your user ID and the reason.
