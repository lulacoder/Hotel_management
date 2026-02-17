# Cashier & Admin Booking/Room Management Update — Implementation Report

## 1) Executive Summary

This document records the implementation completed to address PM feedback for cashier and admin operations.

### Delivered outcomes

- Added booking detail visibility (including confirmed room) for admin/cashier flows.
- Added controlled booking status transitions for admin and cashier.
- Added cashier/admin cash payment acceptance for bookings.
- Expanded cashier access to room management flows (navigation, pages, and backend permissions).
- Fixed cashier dashboard navigation issue where "Back to Hotels" led to an access-denied screen.
- Updated back-link copy to "Back to My Hotel" on hotel detail for consistent cashier/admin UX.

---

## 2) Product Requirements Addressed

### 2.1 Booking detail visibility

**Requirement:** Cashier/admin must see which room a guest confirmed.

**Implemented:**
- Booking detail now includes room number and room type in:
  - booking list modal,
  - dedicated booking detail page.

### 2.2 Booking status controls

**Requirement:** Both cashier and admin can change booking status.

**Implemented transitions:**
- `held -> confirmed`
- `confirmed -> checked_in`
- `checked_in -> checked_out`
- `held/confirmed -> cancelled`

Transition validation is enforced server-side.

### 2.3 Cash payment handling

**Requirement:** Cashier can accept cash and update booking payment state.

**Implemented:**
- Added action to mark `paymentStatus` as `paid` without forcing additional status changes.

### 2.4 Cashier room management access

**Requirement:** Cashier must manage rooms (not bookings-only).

**Implemented:**
- Cashier can access rooms navigation and room management views for assigned hotel.
- Backend room mutations now authorize assigned hotel staff (including cashier), not only hotel admins.

---

## 3) Backend Changes

## 3.1 Booking domain updates

### File changed
- `convex/bookings.ts`

### New mutations
- `updateStatus`
  - Validates role/hotel access.
  - Enforces allowed transition matrix.
  - Idempotent for same-state requests.
  - Writes audit event: `booking_status_updated`.

- `acceptCashPayment`
  - Allows assigned hotel staff and room admins.
  - Sets `paymentStatus: 'paid'`.
  - Blocks cancelled/expired bookings.
  - Idempotent if already paid.
  - Writes audit event: `booking_payment_paid_cash`.

### Permission alignment updates
- `cancelBooking`
  - Expanded from hotel_admin-only to assigned hotel staff for hotel-scoped cancellation authority.
- `getEnriched`
  - Allows assigned hotel staff to view non-owned booking details for same hotel.

## 3.2 Room domain authorization updates

### File changed
- `convex/rooms.ts`

### Authorization change
- Replaced `requireHotelManagement` with `requireHotelAccess` for room mutations:
  - `create`
  - `update`
  - `updateStatus`
  - `softDelete`
  - `restore`

**Effect:** Assigned cashiers can now perform room management actions for their hotel.

---

## 4) Frontend Changes

## 4.1 Admin bookings list enhancements

### File changed
- `src/routes/admin/bookings/index.tsx`

### Added capabilities
- `View Detail` modal from booking cards.
- `Open Page` navigation to dedicated booking detail route.
- `Accept Cash` action.
- Status transition action buttons.
- Modal content includes room number/type, guest, hotel, stay and payment fields.

## 4.2 Dedicated booking detail page

### New file
- `src/routes/admin/bookings/$bookingId.tsx`

### Features
- Full booking detail presentation including confirmed room details.
- Action panel for status transitions and cash payment acceptance.
- Permission-aware controls for room admin and assigned hotel staff.

## 4.3 Route tree/type updates

### File updated (generated)
- `src/routeTree.gen.ts`

### Result
- New route registered: `/admin/bookings/$bookingId`.

## 4.4 Cashier navigation and access changes

### Files changed
- `src/routes/admin.tsx`
- `src/routes/admin/rooms/index.tsx`
- `src/routes/admin/hotels/index.tsx`

### Behavior updates
- Sidebar for `hotel_cashier` now includes:
  - `Bookings`
  - `Rooms`
- Removed cashier-only "bookings-only" denial from Rooms page.
- Removed cashier-only denial from Hotels index that blocked return navigation.
- Hotels page remains filtered to assigned hotel for non-room_admin users.
- Hotel edit action visibility is constrained:
  - visible for `room_admin` and `hotel_admin`,
  - hidden for cashier.

## 4.5 Back-link copy update

### File changed
- `src/routes/admin/hotels/$hotelId.tsx`

### Copy change
- Updated back-link text from `Back to Hotels` to `Back to My Hotel` (both occurrences).

---

## 5) Validation Performed

- Targeted diagnostics were run on changed backend/frontend files and returned no errors.
- Build was intentionally not re-run in the latest pass per user request.

---

## 6) Files Added/Modified

### Added
- `src/routes/admin/bookings/$bookingId.tsx`
- `doc/cashier-admin-booking-room-management-update.md`

### Modified
- `convex/bookings.ts`
- `convex/rooms.ts`
- `src/routes/admin.tsx`
- `src/routes/admin/bookings/index.tsx`
- `src/routes/admin/hotels/index.tsx`
- `src/routes/admin/hotels/$hotelId.tsx`
- `src/routes/admin/rooms/index.tsx`
- `src/routeTree.gen.ts`

---

## 7) Final Outcome

The cashier role now supports the required operational scope for this phase:

- Can manage bookings with status changes and cash payment acceptance.
- Can view booking details including confirmed room information.
- Can access and manage rooms for assigned hotel through dashboard navigation and backend-authorized actions.

Admin behavior remains intact while sharing the same booking/room operational path where applicable.
