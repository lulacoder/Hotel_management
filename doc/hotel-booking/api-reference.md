# API Reference

This document lists all Convex functions (queries and mutations) available in the hotel booking system.

## Authentication Helpers

Located in: [convex/lib/auth.ts](../../convex/lib/auth.ts)

These helpers are used internally by other functions.

| Function                            | Returns        | Description                                     |
| ----------------------------------- | -------------- | ----------------------------------------------- |
| `getCurrentUser(ctx, clerkUserId)`  | `User \| null` | Get user by Clerk ID, returns null if not found |
| `requireUser(ctx, clerkUserId)`     | `User`         | Get user or throw error if not found            |
| `requireAdmin(ctx, clerkUserId)`    | `User`         | Get user and verify admin role                  |
| `requireCustomer(ctx, clerkUserId)` | `User`         | Get user and verify customer role               |
| `isAdmin(user)`                     | `boolean`      | Check if user has admin role                    |
| `isCustomer(user)`                  | `boolean`      | Check if user has customer role                 |

## Hotels API

Located in: [convex/hotels.ts](../../convex/hotels.ts)

### Queries

#### `hotels.list`

List all non-deleted hotels.

```typescript
const hotels = useQuery(api.hotels.list, {})
```

**Args:** None  
**Returns:** `Hotel[]`  
**Auth:** Public (no auth required)

---

#### `hotels.get`

Get a single hotel by ID.

```typescript
const hotel = useQuery(api.hotels.get, { hotelId: '...' })
```

**Args:** `{ hotelId: Id<"hotels"> }`  
**Returns:** `Hotel | null`  
**Auth:** Public

---

#### `hotels.getByCity`

Get hotels in a specific city.

```typescript
const hotels = useQuery(api.hotels.getByCity, { city: 'New York' })
```

**Args:** `{ city: string }`  
**Returns:** `Hotel[]`  
**Auth:** Public

---

#### `hotels.search`

Search hotels by name (fuzzy matching).

```typescript
const hotels = useQuery(api.hotels.search, { query: 'grand' })
```

**Args:** `{ query: string }`  
**Returns:** `Hotel[]`  
**Auth:** Public

---

#### `hotels.getCities`

Get list of unique cities with hotels.

```typescript
const cities = useQuery(api.hotels.getCities, {})
```

**Args:** None  
**Returns:** `string[]`  
**Auth:** Public

---

#### `hotels.getCountries`

Get list of unique countries with hotels.

```typescript
const countries = useQuery(api.hotels.getCountries, {})
```

**Args:** None  
**Returns:** `string[]`  
**Auth:** Public

### Mutations

#### `hotels.create`

Create a new hotel.

```typescript
const hotelId = await createHotel({
  clerkUserId: user.id,
  name: 'Grand Hotel',
  address: '123 Main St',
  city: 'New York',
  country: 'USA',
})
```

**Args:** `{ clerkUserId, name, address, city, country }`  
**Returns:** `Id<"hotels">`  
**Auth:** Admin only

---

#### `hotels.update`

Update an existing hotel.

```typescript
await updateHotel({
  clerkUserId: user.id,
  hotelId: '...',
  name: 'Grand Hotel & Spa',
  // ... other fields (all optional)
})
```

**Args:** `{ clerkUserId, hotelId, name?, address?, city?, country? }`  
**Returns:** `null`  
**Auth:** Admin only

---

#### `hotels.softDelete`

Soft delete a hotel (sets `isDeleted: true`).

```typescript
await softDelete({
  clerkUserId: user.id,
  hotelId: '...',
})
```

**Args:** `{ clerkUserId, hotelId }`  
**Returns:** `null`  
**Auth:** Admin only

---

#### `hotels.restore`

Restore a soft-deleted hotel.

```typescript
await restore({
  clerkUserId: user.id,
  hotelId: '...',
})
```

**Args:** `{ clerkUserId, hotelId }`  
**Returns:** `null`  
**Auth:** Admin only

## Rooms API

Located in: [convex/rooms.ts](../../convex/rooms.ts)

### Queries

#### `rooms.getByHotel`

Get all rooms for a hotel.

```typescript
const rooms = useQuery(api.rooms.getByHotel, {
  hotelId: '...',
  includeDeleted: false, // Optional, default false
})
```

**Args:** `{ hotelId, includeDeleted? }`  
**Returns:** `Room[]`  
**Auth:** Public

---

#### `rooms.get`

Get a single room by ID.

```typescript
const room = useQuery(api.rooms.get, { roomId: '...' })
```

**Args:** `{ roomId: Id<"rooms"> }`  
**Returns:** `Room | null`  
**Auth:** Public

---

#### `rooms.checkAvailability`

Check if a room is available for specific dates.

```typescript
const isAvailable = useQuery(api.rooms.checkAvailability, {
  roomId: '...',
  checkIn: '2024-03-15',
  checkOut: '2024-03-18',
})
```

**Args:** `{ roomId, checkIn, checkOut }`  
**Returns:** `boolean`  
**Auth:** Public

---

#### `rooms.getAvailableRooms`

Get all available rooms for a hotel on specific dates.

```typescript
const rooms = useQuery(api.rooms.getAvailableRooms, {
  clerkUserId: user.id,
  hotelId: '...',
  checkIn: '2024-03-15',
  checkOut: '2024-03-18',
})
```

**Args:** `{ clerkUserId, hotelId, checkIn, checkOut }`  
**Returns:** `Room[]`  
**Auth:** Customer required

### Mutations

#### `rooms.create`

Create a new room.

```typescript
const roomId = await createRoom({
  clerkUserId: user.id,
  hotelId: '...',
  roomNumber: '101',
  type: 'double', // single | double | suite | deluxe
  capacity: 2,
  basePrice: 15000, // In cents ($150.00)
  amenities: ['wifi', 'tv', 'ac'],
})
```

**Args:** `{ clerkUserId, hotelId, roomNumber, type, capacity, basePrice, amenities? }`  
**Returns:** `Id<"rooms">`  
**Auth:** Admin only

---

#### `rooms.update`

Update an existing room.

```typescript
await updateRoom({
  clerkUserId: user.id,
  roomId: '...',
  basePrice: 17500, // Price increase
  // ... other fields (all optional)
})
```

**Args:** `{ clerkUserId, roomId, roomNumber?, type?, capacity?, basePrice?, amenities? }`  
**Returns:** `null`  
**Auth:** Admin only

---

#### `rooms.updateStatus`

Change room operational status.

```typescript
await updateStatus({
  clerkUserId: user.id,
  roomId: '...',
  status: 'maintenance', // available | maintenance | out_of_service
})
```

**Args:** `{ clerkUserId, roomId, status }`  
**Returns:** `null`  
**Auth:** Admin only

---

#### `rooms.softDelete`

Soft delete a room.

```typescript
await softDelete({
  clerkUserId: user.id,
  roomId: '...',
})
```

**Args:** `{ clerkUserId, roomId }`  
**Returns:** `null`  
**Auth:** Admin only

---

#### `rooms.restore`

Restore a soft-deleted room.

```typescript
await restore({
  clerkUserId: user.id,
  roomId: '...',
})
```

**Args:** `{ clerkUserId, roomId }`  
**Returns:** `null`  
**Auth:** Admin only

## Bookings API

Located in: [convex/bookings.ts](../../convex/bookings.ts)

### Queries

#### `bookings.get`

Get a single booking by ID.

```typescript
const booking = useQuery(api.bookings.get, {
  clerkUserId: user.id,
  bookingId: '...',
})
```

**Args:** `{ clerkUserId, bookingId }`  
**Returns:** `Booking | null`  
**Auth:** Own booking (customer) or any booking (admin)

---

#### `bookings.getByUser`

Get all bookings for a user.

```typescript
const bookings = useQuery(api.bookings.getByUser, {
  clerkUserId: user.id,
  userId: '...', // Optional, admin can query for any user
  status: 'confirmed', // Optional filter
})
```

**Args:** `{ clerkUserId, userId?, status? }`  
**Returns:** `Booking[]`  
**Auth:** Own bookings (customer) or any user (admin)

---

#### `bookings.getByHotel`

Get all bookings for a hotel.

```typescript
const bookings = useQuery(api.bookings.getByHotel, {
  clerkUserId: user.id,
  hotelId: '...',
  status: 'held', // Optional filter
})
```

**Args:** `{ clerkUserId, hotelId, status? }`  
**Returns:** `Booking[]`  
**Auth:** Admin only

---

#### `bookings.getByRoom`

Get all bookings for a specific room.

```typescript
const bookings = useQuery(api.bookings.getByRoom, {
  clerkUserId: user.id,
  roomId: '...',
  status: 'confirmed',
})
```

**Args:** `{ clerkUserId, roomId, status? }`  
**Returns:** `Booking[]`  
**Auth:** Admin only

---

#### `bookings.getEnriched`

Get a booking with hotel and room details.

```typescript
const data = useQuery(api.bookings.getEnriched, {
  clerkUserId: user.id,
  bookingId: '...',
})
// Returns: { booking, room: { _id, roomNumber, type }, hotel: { _id, name, address, city } }
```

**Args:** `{ clerkUserId, bookingId }`  
**Returns:** `{ booking, room, hotel } | null`  
**Auth:** Own booking (customer) or any booking (admin)

---

#### `bookings.getMyBookingsEnriched`

Get all current user's bookings with hotel and room details.

```typescript
const bookings = useQuery(api.bookings.getMyBookingsEnriched, {
  clerkUserId: user.id,
  status: 'confirmed', // Optional filter
})
```

**Args:** `{ clerkUserId, status? }`  
**Returns:** `Array<{ booking, room, hotel }>`  
**Auth:** Customer required

### Mutations

#### `bookings.holdRoom`

Create a new booking with "held" status (15-minute hold).

```typescript
const bookingId = await holdRoom({
  clerkUserId: user.id,
  roomId: '...',
  checkIn: '2024-03-15',
  checkOut: '2024-03-18',
  guestName: 'John Doe', // Optional
  guestEmail: 'john@email.com', // Optional
  specialRequests: 'Late checkout', // Optional
})
```

**Args:** `{ clerkUserId, roomId, checkIn, checkOut, guestName?, guestEmail?, specialRequests? }`  
**Returns:** `Id<"bookings">`  
**Auth:** Customer only  
**Errors:**

- Room not found
- Room not available (status)
- Dates overlap with existing booking

---

#### `bookings.confirmBooking`

Confirm a held booking.

```typescript
await confirmBooking({
  clerkUserId: user.id,
  bookingId: '...',
})
```

**Args:** `{ clerkUserId, bookingId }`  
**Returns:** `null`  
**Auth:** Owner only (customer)  
**Errors:**

- Booking not found
- Not your booking
- Not in "held" status
- Hold expired

---

#### `bookings.cancelBooking`

Cancel a booking.

```typescript
await cancelBooking({
  clerkUserId: user.id,
  bookingId: '...',
  reason: 'Plans changed', // Optional
})
```

**Args:** `{ clerkUserId, bookingId, reason? }`  
**Returns:** `null`  
**Auth:** Own booking (customer) or any booking (admin)  
**Notes:**

- Idempotent for already-cancelled bookings
- Cannot cancel checked_out bookings

## Audit API

Located in: [convex/audit.ts](../../convex/audit.ts)

### Queries

#### `audit.getByTarget`

Get audit events for a specific entity.

```typescript
const events = useQuery(api.audit.getByTarget, {
  clerkUserId: user.id,
  targetType: 'booking',
  targetId: '...',
  limit: 50, // Optional, default 50
})
```

**Args:** `{ clerkUserId, targetType, targetId, limit? }`  
**Returns:** `AuditEvent[]`  
**Auth:** Admin only

---

#### `audit.getRecent`

Get recent audit events.

```typescript
const events = useQuery(api.audit.getRecent, {
  clerkUserId: user.id,
  limit: 100, // Optional, default 100
})
```

**Args:** `{ clerkUserId, limit? }`  
**Returns:** `AuditEvent[]`  
**Auth:** Admin only

### Internal Functions

#### `createAuditLog` (helper function)

Used internally by other mutations to log events.

```typescript
await createAuditLog(ctx, {
  actorId: user._id,
  action: 'booking_confirmed',
  targetType: 'booking',
  targetId: bookingId,
  previousValue: { status: 'held' },
  newValue: { status: 'confirmed' },
  metadata: { source: 'web' }, // Optional
})
```

## Internal/Scheduled Functions

Located in: [convex/bookingsInternal.ts](../../convex/bookingsInternal.ts) and [convex/crons.ts](../../convex/crons.ts)

#### `bookingsInternal.cleanupExpiredHolds`

Internal mutation called by cron job to expire held bookings.

**Schedule:** Every 5 minutes  
**Action:** Finds all `held` bookings where `holdExpiresAt < now` and sets them to `expired`

## Error Codes

All errors thrown by Convex functions use this format:

```typescript
throw new ConvexError({
  code: 'ERROR_CODE',
  message: 'Human-readable message',
})
```

| Code               | Meaning                                      |
| ------------------ | -------------------------------------------- |
| `NOT_FOUND`        | Resource doesn't exist                       |
| `FORBIDDEN`        | User lacks permission                        |
| `UNAUTHORIZED`     | User not authenticated                       |
| `CONFLICT`         | Resource conflict (e.g., room not available) |
| `INVALID_STATE`    | Operation not valid for current state        |
| `EXPIRED`          | Hold has expired                             |
| `UNAVAILABLE`      | Room not available for booking               |
| `VALIDATION_ERROR` | Invalid input data                           |
