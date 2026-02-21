# Outsource Booking — Implementation Report

## 1) Summary

This document records the outsourced-booking feature as implemented in the codebase.

When a hotel can no longer host a guest, hotel-level operations staff (`hotel_admin`, `hotel_cashier`) can mark a booking as `outsourced` and record the destination hotel. The action is visible in admin booking surfaces, audited, and treated as a terminal operational state for cashier/admin actions.

---

## 2) Scope Implemented

### Included

- New booking status: `outsourced`
- Destination hotel tracking on booking:
  - `outsourcedToHotelId`
  - `outsourcedAt`
- Backend mutation to outsource with authorization + validation
- Backend query to list valid destination hotels
- Admin booking UI updates:
  - outsource button in booking list row
  - outsource button in inline booking-detail modal
  - outsource button in full booking-detail page
  - outsourced status badge and status filter option
  - destination hotel display in full booking detail (audit trail)
- Audit log event: `booking_outsourced`

### Excluded (by current implementation decision)

- No automatic creation/transfer of a new booking in the destination hotel
- No room live-state/occupancy availability logic change in this feature
- No customer-facing booking UI updates in this feature

---

## 3) Data Model Changes

### File

- `convex/schema.ts`

### `bookings` table updates

- `status` union includes `outsourced`
- `outsourcedToHotelId: v.optional(v.id('hotels'))`
- `outsourcedAt: v.optional(v.number())`

These fields are populated when a booking is outsourced.

---

## 4) Backend Implementation

## 4.1 Booking validators + enriched contract

### File

- `convex/bookings.ts`

### Changes

- `bookingStatusValidator` includes `outsourced`
- `bookingValidator` includes:
  - `outsourcedToHotelId`
  - `outsourcedAt`
- `getEnriched` hotel payload includes `country` (used by outsource modal display)

## 4.2 New mutation: `outsourceBooking`

### Signature

```ts
outsourceBooking({
  clerkUserId,
  bookingId,
  destinationHotelId,
}) => null
```

### Business and permission rules

1. Authenticated user required (`requireUser`)
2. `room_admin` explicitly blocked (`FORBIDDEN`)
3. Booking must exist (`NOT_FOUND`)
4. Caller must have access to booking's hotel (`requireHotelAccess`)
5. Caller must be hotel-level staff role: `hotel_admin` or `hotel_cashier`
6. Booking status must be `confirmed` or `checked_in` (`INVALID_STATE` otherwise)
7. Destination hotel must exist and not be deleted (`NOT_FOUND`)
8. Destination hotel cannot equal source booking hotel (`INVALID_INPUT`)

### Write behavior

Booking patch:

```ts
{
  status: 'outsourced',
  outsourcedToHotelId: destinationHotelId,
  outsourcedAt: Date.now(),
  updatedAt: Date.now(),
  updatedBy: user._id,
}
```

Audit log:

- `action: 'booking_outsourced'`
- `targetType: 'booking'`
- `targetId: bookingId`
- `previousValue.status` and `newValue.status`
- metadata includes `sourceHotelId`

## 4.3 Terminal-state safeguards

### File

- `convex/bookings.ts`

### Changes

- `updateStatus` transitions now include `outsourced: []` (no next transitions)
- `cancelBooking` rejects `outsourced` with `INVALID_STATE`
- `acceptCashPayment` rejects `outsourced` with `INVALID_STATE`

This enforces terminal behavior for operational cashier/admin actions.

## 4.4 New destination list query

### File

- `convex/hotels.ts`

### Query

- `listForOutsource({ clerkUserId, excludeHotelId })`

### Behavior

- Requires authenticated user
- Returns active (`isDeleted === false`) hotels
- Excludes `excludeHotelId`
- Returns fields: `_id`, `name`, `city`, `country`
- Sorted by hotel `name`

---

## 5) Frontend Implementation

## 5.1 New component: outsource modal

### File

- `src/routes/admin/bookings/components/-OutsourceModal.tsx`

### Behavior

- Shows read-only summary:
  - current hotel
  - guest
  - stay dates
  - amount paid (`paid` => formatted amount, else `Pending`)
- Loads destination hotels using `hotels.listForOutsource`
- Confirm disabled until destination selected
- Calls `bookings.outsourceBooking`
- Displays inline error on failure
- Shows success text `Outsourced ✓`, then closes after 1.5s via `onSuccess`

## 5.2 Admin bookings list page

### File

- `src/routes/admin/bookings/index.tsx`

### Changes

- Added `outsourced` to `statusConfig` (purple badge)
- Added `Outsourced` to status filter dropdown
- Added `Outsource` action button on row for:
  - role not `room_admin`
  - staff has booking management access
  - booking status in `confirmed | checked_in`
- Added `Outsource` action inside inline detail modal with same visibility rules
- Mounted `OutsourceModal` at page level using selected outsource booking id
- Prevented `Accept Cash` action for `outsourced` bookings

## 5.3 Admin full booking detail page

### File

- `src/routes/admin/bookings/$bookingId.tsx`

### Changes

- Added `outsourced` to `statusConfig` (purple badge)
- Added `Outsource` button in Actions for:
  - role not `room_admin`
  - booking status in `confirmed | checked_in`
- Mounted `OutsourceModal`
- Added `Outsourced To` section (destination hotel name + city/country)
- Prevented `Accept Cash Payment` for `outsourced` bookings

---

## 6) How Other Hotel Admins/Cashiers Are Affected

This section explains cross-hotel operational impact, especially for staff not in the source hotel.

## 6.1 Source hotel staff (the hotel that outsourced)

- `hotel_admin` and `hotel_cashier` assigned to the source hotel can perform outsource
- Once outsourced, booking remains in source hotel's records with status `Outsourced`
- Source hotel can still view full booking trail and destination target
- Source hotel cannot continue cashier/admin terminal actions on that booking (cancel/payment transition guards)

## 6.2 Destination hotel staff (the hotel selected as destination)

- Destination hotel appears as a selectable target in the source hotel's modal
- Destination hotel staff do **not** automatically receive a new booking record in this release
- Destination hotel staff cannot act on the original outsourced booking unless they otherwise have platform visibility/permissions
- Operationally, destination coordination is currently an external/manual process (phone/desk/other workflow), with this feature serving as origin-side audit marking

## 6.3 Other hotels' admins/cashiers (neither source nor destination)

- They cannot outsource bookings from hotels they are not assigned to (backend access checks)
- They do not see outsource action for bookings outside their authorized scope
- No data mutation rights are introduced for unrelated hotels

## 6.4 Room admin (platform)

- Room admin sees `outsourced` status in bookings data and UI status rendering
- Room admin is explicitly blocked from triggering outsource mutation
- This keeps outsource action limited to hotel operations roles only

---

## 7) Security and Authorization Notes

- Auth is mandatory on outsource operations
- Hotel assignment boundary enforced server-side
- Role checks are enforced server-side (not UI-only)
- Destination hotel validity (`exists && !isDeleted`) is server-enforced
- Same-hotel outsourcing blocked server-side

---

## 8) Audit and Traceability

Every successful outsource action writes an audit event:

- `action: booking_outsourced`
- actor id
- booking id
- previous status
- new status + destination id + timestamp
- source hotel metadata

This provides traceability for relocation events and role accountability.

---

## 9) Files Updated

- `convex/schema.ts`
- `convex/bookings.ts`
- `convex/hotels.ts`
- `src/routes/admin/bookings/components/-OutsourceModal.tsx` (new)
- `src/routes/admin/bookings/index.tsx`
- `src/routes/admin/bookings/$bookingId.tsx`

---

## 10) Validation Results

## Build

- `npm run build` passed after implementation.

## Diagnostics

- No file-level diagnostics in changed outsource-related files.

## Lint context

- Repository-wide lint still reports pre-existing issues in generated/build artifacts and unrelated files.
- No new blocking lint errors remained in changed outsource feature files after cleanup.

---

## 11) Current Limitations / Follow-ups

1. Destination booking handoff is not automated
   - No booking clone/transfer exists in destination hotel records yet.
2. Room occupancy/live-state interactions are unchanged in this feature
   - If business requires outsourced to immediately free inventory in room-state logic, this should be added in a follow-up change.
3. Customer-facing display for outsourced state is unchanged in this scope
   - Can be added later if product wants customer visibility.

---

## 12) Manual QA Checklist

### Core flow

- [ ] Cashier can outsource `confirmed` booking from list row
- [ ] Cashier can outsource `checked_in` booking from list row
- [ ] Same works from inline detail modal
- [ ] Same works from full detail page
- [ ] Destination dropdown excludes source hotel and deleted hotels
- [ ] Success updates booking badge to `Outsourced`
- [ ] Status filter `Outsourced` returns expected rows

### Permissions

- [ ] Room admin does not see outsource action button
- [ ] Hotel admin/cashier from unrelated hotel cannot outsource booking
- [ ] Staff without hotel assignment cannot outsource

### Terminal behavior

- [ ] `Accept Cash` unavailable for outsourced booking
- [ ] Status transition actions unavailable for outsourced booking
- [ ] Cancel action rejected for outsourced booking

### Audit trail

- [ ] Audit event `booking_outsourced` is written with expected payload
- [ ] Full booking detail shows destination hotel under `Outsourced To`
