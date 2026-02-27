Current State
Authentication is complete using Clerk with public metadata roles (customer | room_admin)
Users table exists with clerkUserId, email, role, createdAt
Ready to implement hotels, rooms, bookings, and audit logs
Schema Requirements
Extend the existing convex/schema.ts with these tables:
hotels: name, address, city, country, location (lat/lng), metadata (optional record), createdAt, updatedAt
rooms: hotelId (foreign key), roomNumber, type (single/double/suite/deluxe), basePrice (number), maxOccupancy, operationalStatus (available/maintenance/cleaning/out_of_order), amenities (optional string array), createdAt, updatedAt
bookings: userId, roomId, hotelId (denormalized), checkIn (YYYY-MM-DD string), checkOut (YYYY-MM-DD string), status (held/confirmed/checked_in/checked_out/cancelled/expired), holdExpiresAt (optional timestamp), paymentStatus (optional pending/paid/failed/refunded), pricePerNight, totalPrice, guestName, guestEmail, specialRequests (all optional), createdAt, updatedAt, updatedBy (optional user id)
auditEvents: actorId, action (string), targetType (hotel/room/booking), targetId, previousValue (optional any), newValue (optional any), metadata (optional record), timestamp
Critical Indexes
hotels: by_city, by_location
rooms: by_hotel, by_hotel_and_status
bookings: by_room, by_user, by_status, by_room_and_status, by_room_and_checkin
auditEvents: by_actor, by_target, by_timestamp
Convex Functions to Implement
Queries:
getHotelsByCity(city: string) - List hotels in a city
getRoomsByHotel(hotelId: string, status?: string) - List rooms, optionally filter by operational status
checkAvailability(roomId: string, checkIn: string, checkOut: string) - Return true if room is available (no overlapping confirmed/held bookings). Check held bookings are not expired.
getBooking(bookingId: string) - Get single booking details
getUserBookings(userId: string) - List user's bookings
Mutations:
createHotel - Admin only (check role from context.auth.userId lookup)
createRoom - Admin only
updateRoomStatus - Admin only (updates operationalStatus, logs to auditEvents)
holdRoom(userId, roomId, checkIn, checkOut) - Customer only. Atomic transaction: check availability, create booking with status "held", holdExpiresAt = now + 15 minutes, price snapshot from room basePrice. If conflict, throw error.
confirmBooking(bookingId) - Customer only (their own booking). Updates status to "confirmed", paymentStatus to "pending" (payment stub for now).
cancelBooking(bookingId) - Customer (own booking) or Admin. Updates status to "cancelled" or "expired".
cleanupExpiredHolds - Internal/scheduled. Find held bookings where holdExpiresAt < now, update status to "expired".
Implementation Details
Use Clerk's userId from ctx.auth.userId in Convex functions
Verify role by looking up user in users table (already exists)
For date overlap logic: (checkInA < checkOutB) AND (checkOutA > checkInB)
Audit logging: Create auditEvents entry on every room status change and booking status change
All prices stored as integers (cents) to avoid floating point
Denormalize hotelId in bookings for efficient queries
Testing Checklist
[ ] Admin can create hotel and rooms
[ ] Customer can query available rooms
[ ] Two simultaneous hold attempts on same room/dates: one succeeds, one fails with clear error
[ ] Held booking expires after 15 minutes (test via manual DB update or wait)
[ ] Audit logs capture who changed room status
[ ] Role-based access control enforced (customer cannot create hotels, admin cannot hold rooms)
Deliverables
Updated convex/schema.ts with all tables and indexes
convex/hotels.ts with hotel queries and mutations (admin-only)
convex/rooms.ts with room queries and mutations (admin-only)
convex/bookings.ts with availability check, hold, confirm, cancel (mixed permissions)
convex/audit.ts with audit logging helper function