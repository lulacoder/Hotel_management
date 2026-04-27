# Walk-in Booking — Implementation Report

Date: 2026-02-20

## Summary
This report documents the implementation of walk-in booking support and related admin booking updates.

Implemented areas:
- Backend data model updates for guest profiles and optional booking ownership.
- New guest profile API for search and idempotent create.
- New walk-in booking mutation with direct `confirmed` status.
- Admin navigation and UI flow for walk-in booking.
- Booking list/detail enrichment with walk-in guest profile data.
- Room-admin all-hotels booking visibility in admin bookings list.

## Backend Changes

### Schema
Updated `convex/schema.ts`:
- Added `guestProfiles` table with indexes:
  - `by_phone`
  - `by_email`
  - `by_linked_user`
- Updated `bookings` table:
  - `userId` changed to optional.
  - `guestProfileId` added as optional.
  - Added `by_guest_profile` index.

### New API Module
Added `convex/guestProfiles.ts`:
- `findOrCreate` mutation
  - Requires hotel staff (`hotel_cashier` / `hotel_admin`) or `room_admin`.
  - Enforces: guest `name` required and at least one of `phone`/`email`.
  - Normalizes phone (digits only) and email (lowercase + trim).
  - Dedupe order: phone first, then email.
- `search` query
  - Searches by phone/email term.
  - Returns profile + booking count.
- `get` query
  - Returns a single guest profile by ID.

### Booking Logic
Updated `convex/bookings.ts`:
- Added `walkInBooking` mutation:
  - Allowed roles: `hotel_cashier` and `hotel_admin`.
  - Validates room availability and date overlap.
  - Creates booking directly in `confirmed` state with `paymentStatus: pending`.
  - Links `guestProfileId` and optional `userId` from `linkedUserId`.
  - Writes audit log action `walk_in_booking_created`.
- Updated `getByHotel` query:
  - Accepts optional `hotelId`.
  - If `hotelId` omitted, only `room_admin` can fetch cross-hotel bookings.
  - Returns enriched payload with `guestProfile` and `linkedUser` summaries.
- Updated `getEnriched` query:
  - Adds `guestProfile` and `linkedUser` summaries.

### Internal Safety Fix
Updated `convex/bookingsInternal.ts`:
- Guarded audit insertion in expired-hold cleanup when `booking.userId` is absent.

## Frontend Changes

### Admin Navigation
Updated `src/routes/admin.tsx`:
- Added nav item: `/admin/walk-in`.
- Visibility:
  - `hotel_cashier`: visible.
  - `hotel_admin`: visible.
  - `room_admin`: not shown as a dedicated workflow item.

### Walk-in Route
Added `src/routes/admin/walk-in/index.tsx`:
- Step 1: Guest search or create profile.
- Step 2: Date and available room selection.
- Step 3: Package selection, summary, and `Book & Confirm`.
- On success: redirects to `/admin/bookings`.

### Booking Admin UI
Updated:
- `src/routes/admin/bookings/index.tsx`
- `src/routes/admin/bookings/$bookingId.tsx`

Behavior updates:
- Booking list/detail now show walk-in guest profile fields when present.
- Shows linked user as secondary info when available.
- Room-admin can query bookings across all hotels (when hotel filter is `all`).

## Generated Files Updated
- `src/routeTree.gen.ts` (new `/admin/walk-in/` route)
- `convex/_generated/api.d.ts` (new `guestProfiles` module)

## Validation Notes
- Build succeeded: `npm run build`.
- Targeted lint run on changed files found one remaining issue:
  - `convex/bookingsInternal.ts` import order (`convex/values` should be before `./_generated/server`).

## Known Scope Alignment
The implementation reflects approved scope decisions during planning:
- Walk-in creation enabled for both `hotel_cashier` and `hotel_admin`.
- Guest profile dedupe uses normalized phone first, then email.
- Guest profiles are global (not hotel-scoped).
- Room-admin all-hotels booking visibility is included.

## Follow-up Recommendation
- Apply the single lint import-order fix in `convex/bookingsInternal.ts` to make targeted lint clean for changed files.
