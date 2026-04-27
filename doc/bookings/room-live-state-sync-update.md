# Room Live State Sync Update — Implementation Report

## 1) Executive Summary

This document records the fix for room status not reflecting booking/hold state across admin hotel room management views.

### Delivered outcomes

- Added a backend live-state query for rooms that derives current room state from active bookings.
- Updated admin hotel room cards to use live state (`held`, `booked`, etc.) instead of only static operational status.
- Preserved existing room operational controls (available/maintenance/cleaning/out_of_order) without breaking current admin/cashier workflows.
- Ensured expired holds do not block room availability display.

---

## 2) Problem Statement

### Observed issue

When a room was held or booked by a customer, the room card in admin surfaces (room admin / hotel admin / cashier assigned to hotel) continued to show the original `operationalStatus` (commonly `available`) instead of reflecting that it was currently reserved.

### Root cause

Admin room cards were rendered from `api.rooms.getByHotel`, which only returns static room operational data from the `rooms` table and does not derive status from booking records.

---

## 3) Solution Implemented

## 3.1 Backend: live room-state derivation

### File changed
- `convex/rooms.ts`

### New validators/types
- Added `roomLiveStateValidator` with:
  - `available`
  - `maintenance`
  - `cleaning`
  - `out_of_order`
  - `held`
  - `booked`

- Added `roomWithLiveStateValidator` by extending the existing room validator.

### New helper
- `getDerivedLiveState(operationalStatus, bookings)`

### Derivation logic

1. If `operationalStatus !== 'available'`, return operational state directly:
   - `maintenance`, `cleaning`, `out_of_order` remain authoritative.
2. Otherwise, inspect active bookings for the room:
   - If any booking is `confirmed` or `checked_in` -> `booked`
   - Else if any booking is `held` and hold not expired -> `held`
   - Else -> `available`

### New query
- `getByHotelWithLiveState`
  - Args:
    - `clerkUserId`
    - `hotelId`
    - optional `includeDeleted`
  - Auth:
    - uses `requireHotelAccess`
  - Returns:
    - rooms with added `liveState` field

### Booking filters in derivation

The query excludes non-blocking booking states from active evaluation:
- `cancelled`
- `expired`
- `checked_out`

For held bookings, expired holds are ignored via `isHoldExpired`.

---

## 3.2 Frontend: admin room cards use live state

### File changed
- `src/routes/admin/hotels/$hotelId.tsx`

### Query switch
- Replaced `api.rooms.getByHotel` with `api.rooms.getByHotelWithLiveState`.
- Query now uses role-aware auth context via `clerkUserId`.

### UI status rendering
- Status badge now maps from `room.liveState`.
- Added UI configs for:
  - `held`
  - `booked`

### Status action menu preserved
- Manual operational status actions still only allow:
  - `available`
  - `maintenance`
  - `cleaning`
  - `out_of_order`
- `held/booked` are derived runtime states, not manually settable states.

---

## 4) Behavior After Fix

- If a room is held by an active hold, admin room card displays `Held`.
- If a room has a confirmed/check-in booking, admin room card displays `Booked`.
- If a hold expires, room can return to `Available` automatically in derived display.
- If room is manually marked `maintenance/cleaning/out_of_order`, that state takes precedence in display.

---

## 5) Validation Performed

- Ran Convex deployment/codegen sync:
  - `npx convex dev`
  - Result: Convex functions ready.
- Targeted lint and diagnostics on changed files:
  - `convex/rooms.ts`
  - `src/routes/admin/hotels/$hotelId.tsx`
  - Result: no errors in changed files.

---

## 6) Files Added/Modified

### Modified
- `convex/rooms.ts`
- `src/routes/admin/hotels/$hotelId.tsx`

### Added
- `doc/room-live-state-sync-update.md`

---

## 7) Notes and Scope

- This change updates admin hotel room management views where room cards are rendered.
- Public customer room-listing behavior remains unchanged and still relies on date-range availability queries.
- If needed, the same live-state query can be reused in other admin dashboards/list views for full consistency.
