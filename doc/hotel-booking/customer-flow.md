# Customer Flow

This document walks through the complete customer journey, from browsing hotels to managing bookings.

## The Happy Path

Here's what a typical customer experience looks like:

```
Landing Page → Sign In → Browse Hotels → Select Hotel → Pick Dates → Hold Room → Confirm → Done!
```

Let's trace through each step.

## 1. Landing Page

**Route:** `/` ([src/routes/index.tsx](../../src/routes/index.tsx))

The landing page shows:

- Hero section with value proposition
- Sign in / Sign up buttons
- Features overview

If the user is already signed in, they see a "Go to Dashboard" button instead.

## 2. Authentication

**Routes:** `/sign-in`, `/sign-up`

Clerk handles authentication. After successful login:

1. Clerk redirects to `/post-login`
2. Post-login checks the user's role in Convex
3. Customers are redirected to `/select-location`

See [Authentication Flow](../auth/auth.md) for details.

## 3. Browse Hotels

**Route:** `/select-location` ([src/routes/\_authenticated/select-location.tsx](../../src/routes/_authenticated/select-location.tsx))

**What the customer sees:**

- Search bar (searches hotel names)
- City filter dropdown
- Grid of hotel cards with:
  - Hotel name
  - Location (city, country)
  - "View Rooms" link

**Backend query:** `api.hotels.list`

```typescript
// Returns all non-deleted hotels
const hotels = useQuery(api.hotels.list, {})
```

**Filtering is client-side** for simplicity. For large datasets, you'd want server-side filtering.

## 4. View Hotel & Available Rooms

**Route:** `/hotels/$hotelId` ([src/routes/\_authenticated/hotels.$hotelId.tsx](../../src/routes/_authenticated/hotels.$hotelId.tsx))

**What the customer sees:**

1. Hotel details (name, address, description)
2. Date picker (check-in and check-out)
3. List of available rooms for those dates
4. Each room shows:
   - Room type and number
   - Capacity
   - Amenities
   - Price per night
   - "Book Now" button

**Backend queries:**

```typescript
// Get hotel details
const hotel = useQuery(api.hotels.get, { hotelId })

// Get available rooms for selected dates
const rooms = useQuery(api.rooms.getAvailableRooms, {
  clerkUserId: user.id,
  hotelId,
  checkIn: '2024-03-15',
  checkOut: '2024-03-18',
})
```

**How availability works:**

The `getAvailableRooms` query:

1. Fetches all rooms for the hotel
2. Fetches all bookings for those rooms
3. Filters out rooms with conflicting bookings
4. Returns only bookable rooms

A room is unavailable if ANY active booking overlaps with the requested dates. "Active" means: `held` (not expired), `confirmed`, or `checked_in`.

## 5. Hold a Room

**What happens when customer clicks "Book Now":**

1. A modal opens showing booking summary
2. Customer can add guest name and special requests
3. Customer clicks "Hold Room"

**Backend mutation:** `api.bookings.holdRoom`

```typescript
const bookingId = await holdRoom({
  clerkUserId: user.id,
  roomId: room._id,
  checkIn: '2024-03-15',
  checkOut: '2024-03-18',
  guestName: 'John Doe',
  specialRequests: 'Late checkout please',
})
```

**What the backend does:**

1. **Validates dates** - Check-in must be today or later, check-out must be after check-in
2. **Checks room status** - Must be `available` (not maintenance/out of service)
3. **Checks availability** - No overlapping active bookings
4. **Creates booking** with:
   - Status: `held`
   - `holdExpiresAt`: current time + 15 minutes
   - Price snapshot from room's current `basePrice`
5. **Logs audit event** - `booking_created`

**Important:** Convex uses Optimistic Concurrency Control (OCC). If two customers try to book the same room simultaneously, one will succeed and the other will get a conflict error.

## 6. Confirm Booking

**After holding, the modal updates to show:**

- "Room held for 15 minutes"
- Countdown timer (visual)
- "Confirm Booking" button
- "Cancel" button

**Backend mutation:** `api.bookings.confirmBooking`

```typescript
await confirmBooking({
  clerkUserId: user.id,
  bookingId: booking._id,
})
```

**What the backend does:**

1. **Verifies ownership** - Only the customer who created the hold can confirm
2. **Checks status** - Must be `held`
3. **Checks expiration** - Hold must not be expired
4. **Updates booking**:
   - Status: `confirmed`
   - `paymentStatus`: `pending` (stub for future payment integration)
   - Clears `holdExpiresAt`
5. **Logs audit event** - `booking_confirmed`

## 7. My Bookings

**Route:** `/bookings` ([src/routes/\_authenticated/bookings.tsx](../../src/routes/_authenticated/bookings.tsx))

**What the customer sees:**

- List of all their bookings
- Status filter buttons (All, Held, Confirmed, etc.)
- Each booking shows:
  - Hotel name and address
  - Room type and number
  - Check-in/out dates
  - Price breakdown
  - Status badge
  - Cancel button (for held/confirmed bookings)

**Backend query:** `api.bookings.getMyBookingsEnriched`

```typescript
const bookings = useQuery(api.bookings.getMyBookingsEnriched, {
  clerkUserId: user.id,
})
```

This returns bookings with hotel and room details joined in, so we don't need multiple queries.

## 8. Cancel Booking

Customer can cancel bookings that are `held` or `confirmed`.

**Backend mutation:** `api.bookings.cancelBooking`

```typescript
await cancelBooking({
  clerkUserId: user.id,
  bookingId: booking._id,
  reason: 'Plans changed', // Optional
})
```

**What the backend does:**

1. **Verifies ownership** - Customer can only cancel their own bookings
2. **Checks status** - Can't cancel already cancelled/expired/checked_out
3. **Updates status** to `cancelled`
4. **Logs audit event** - `booking_cancelled` with reason in metadata

## Automatic Hold Expiration

Held bookings that aren't confirmed within 15 minutes are automatically expired.

**How it works:**

1. A cron job runs every 5 minutes ([convex/crons.ts](../../convex/crons.ts))
2. It calls `api.bookingsInternal.cleanupExpiredHolds`
3. The function finds all `held` bookings where `holdExpiresAt < now`
4. Each expired booking is updated to `expired` status
5. Audit events are logged for each expiration

This ensures rooms don't get stuck in "held" limbo.

## Error Handling

The frontend handles these common errors:

| Error                  | User Message                                                                   |
| ---------------------- | ------------------------------------------------------------------------------ |
| Room not available     | "Room is not available for the selected dates. Please choose different dates." |
| Hold expired           | "Your hold has expired. Please create a new booking."                          |
| Room under maintenance | "Room is currently under maintenance and cannot be booked."                    |
| Network error          | Generic error with retry option                                                |

## UI Components & Styling

The customer UI uses:

- **Dark theme** - Slate backgrounds (950, 900, 800)
- **Amber accents** - Primary action color
- **Rounded corners** - 2xl for cards, xl for buttons
- **Lucide icons** - Consistent icon set

Key files:

- Main layout: Header with logo, nav, and user button
- Hotel cards: Gradient image placeholder, hover effects
- Booking modal: Multi-step with hold → confirm flow
- Status badges: Color-coded by booking status
