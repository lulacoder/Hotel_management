# User & Hotel Staff RBAC Refactor — Implementation Report

## 1) Executive Summary

This document describes the **actual implementation** completed for the User & Hotel Staff Management refactor.

The system now supports a hybrid role model:

- **Global roles** (existing):
  - `room_admin`
  - `customer`
- **Hotel-scoped staff roles** (new):
  - `hotel_admin`
  - `hotel_cashier`

The implementation introduces a dedicated assignment table, new Convex APIs for managing staff assignments, hotel-scoped authorization helpers, backend guard upgrades for hotels/rooms/bookings/ratings, and frontend admin UX updates (including a full Users management page and corrected login redirects for assigned staff).

---

## 2) Design Decisions Applied

## 2.1 Keep global and hotel-scoped roles separate

**Decision:** We kept `users.role` unchanged (`customer | room_admin`) and added a separate `hotelStaff` table for scoped permissions.

**Why:**
- Avoids breaking existing role semantics.
- Preserves `room_admin` as an unconditional super role.
- Allows future extension to richer assignment models.

## 2.2 One active assignment per user (application-enforced)

**Decision:** Assignment uniqueness is enforced in mutation logic (`assign`) by checking existing assignment via `by_user` index.

**Why:**
- Matches MVP requirements.
- Avoids schema complexity while preserving deterministic behavior.

## 2.3 Server-side permission boundaries first

**Decision:** Authorization was moved into backend operations using auth helpers:
- `requireHotelAccess`
- `requireHotelManagement`

**Why:**
- Prevents trust in frontend-only filtering.
- Aligns with RBAC best practice where backend is source of truth.

## 2.4 Room admin override everywhere

**Decision:** `room_admin` always bypasses hotel-scoped restrictions.

**Why:**
- Required by product design: room_admin remains unrestricted even if assigned to a hotel.

## 2.5 Cashier scope constrained

**Decision:** Cashiers are restricted to bookings-focused access.
- In admin nav: cashier sees **Bookings only**.
- Backend management actions requiring `requireHotelManagement` are denied to cashier.

**Why:**
- Aligns with selected implementation direction and least-privilege.

## 2.6 Audit trail extended to user assignment events

**Decision:** Audit target type `user` was added and assignment/unassignment actions are logged.

**Why:**
- Hotel staff assignment is an administrative security action and should be traceable.

---

## 3) Backend Implementation Details

## 3.1 Schema changes

### File changed: `convex/schema.ts`

### Added table: `hotelStaff`

Fields:
- `userId: Id<'users'>`
- `hotelId: Id<'hotels'>`
- `role: 'hotel_admin' | 'hotel_cashier'`
- `assignedAt: number`
- `assignedBy: Id<'users'>`

Indexes:
- `by_user` on `userId`
- `by_hotel` on `hotelId`

### Extended audit schema

`auditEvents.targetType` now includes `'user'`.

---

## 3.2 New module for staff management

### New file: `convex/hotelStaff.ts`

### Queries

#### `listAllUsers`
- Requires `room_admin`.
- Returns all users plus optional assignment object.
- Enriches assignment with hotel name/city.

#### `getByUserId`
- Args: `{ clerkUserId, userId }`.
- Allows:
  - self lookup,
  - room_admin lookup,
  - or same-hotel lookup (staff inspecting another assigned user in same hotel).
- Returns assignment or `null`.

#### `getByHotelId`
- Args: `{ clerkUserId, hotelId }`.
- Requires hotel access (`requireHotelAccess`).
- Returns assignments with resolved `userEmail`.

### Mutations

#### `assign`
- Requires `room_admin`.
- Validates:
  - target user exists,
  - user not already assigned,
  - hotel exists and not deleted.
- Inserts assignment and writes audit event:
  - action: `hotel_staff_assigned`
  - targetType: `user`

#### `unassign`
- Requires `room_admin`.
- Validates assignment exists.
- Deletes assignment and writes audit event:
  - action: `hotel_staff_unassigned`
  - targetType: `user`

---

## 3.3 Authorization helpers

### File changed: `convex/lib/auth.ts`

Added:
- `HotelStaffRole` type
- `getHotelAssignment(ctx, userId)`
- `canAccessHotel(ctx, clerkUserId, hotelId)`
- `requireHotelAccess(ctx, clerkUserId, hotelId)`
- `canManageHotel(ctx, clerkUserId, hotelId)`
- `requireHotelManagement(ctx, clerkUserId, hotelId)`

Behavior:
- `room_admin` always passes access/management checks.
- non-admin users must have assignment matching `hotelId` to access.
- only `hotel_admin` can pass management checks for assigned hotel.

---

## 3.4 Existing domain APIs upgraded to scoped checks

## Hotels

### File changed: `convex/hotels.ts`

- `update`, `softDelete`, `restore` switched from `requireAdmin` to `requireHotelManagement`.
- Audit actor now uses returned `user._id`.
- `create` remains `room_admin` only (`requireAdmin`).

## Rooms

### File changed: `convex/rooms.ts`

- Management mutations now use hotel-scoped management checks:
  - `create` uses `requireHotelManagement(..., hotelId)`.
  - `update`, `updateStatus`, `softDelete`, `restore` read room first, then authorize via `room.hotelId`.
- Audit actor now derived from authorized `user._id`.

## Bookings

### File changed: `convex/bookings.ts`

- `getByHotel` now uses `requireHotelAccess`.
- `getByRoom` now resolves room -> requires access to `room.hotelId`.
- `get` allows non-owner read only if requester has assignment to booking hotel.
- `cancelBooking` now supports:
  - `room_admin` (global),
  - `hotel_admin` for assigned hotel,
  - booking owner (self-cancel),
  - denies cashier-as-staff cancellation.

## Ratings

### File changed: `convex/ratings.ts`

- `getHotelRatingsAdmin` now uses `requireHotelAccess` instead of global `requireAdmin`.
- `softDeleteRating` now authorizes using `requireHotelManagement` based on the rating's hotel.
- Outcome:
  - `hotel_admin` can view/manage ratings for assigned hotel.
  - `hotel_cashier` cannot perform rating moderation actions.

---

## 3.5 Audit updates

### File changed: `convex/audit.ts`

- `AuditTargetType` includes `user`.
- Validators for `logEvent`, `getByTarget`, `getRecent` updated accordingly.

---

## 3.6 Generated API/types

### File changed (generated): `convex/_generated/api.d.ts`

- New module surfaced: `api.hotelStaff.*`.

---

## 4) Frontend Implementation Details

## 4.1 Admin route protection and navigation

### File changed: `src/routes/admin.tsx`

### Route-level sign-in guard
- Added `beforeLoad` sign-in redirect using TanStack route guard pattern.

### Access logic
- Loads profile and assignment.
- Access allowed if:
  - `profile.role === 'room_admin'`, or
  - user has `hotelStaff` assignment.

### Navigation visibility
- Base nav now includes `Users`.
- `visibleNavItems` rules:
  - `room_admin`: all items.
  - `hotel_admin`: all except `Users`.
  - `hotel_cashier`: `Bookings` only.

Applied in both mobile and desktop sidebars.

---

## 4.2 New Users management page

### New files
- `src/routes/admin/users/index.tsx`
- `src/routes/admin/users/components/-AssignModal.tsx`

### Users page
- Room-admin-only page.
- Queries:
  - `api.hotelStaff.listAllUsers`
- Features:
  - email search,
  - role badges,
  - assignment display,
  - Assign/Unassign actions,
  - modal integration and error handling.

### Assign modal
- Select hotel dropdown (from `api.hotels.list`).
- Role radio (`hotel_admin` / `hotel_cashier`).
- Validation for required hotel selection.
- Handles loading and mutation error display.

---

## 4.3 Dashboard enhancements

### File changed: `src/routes/admin/index.tsx`

- Added assignment lookup + assigned hotel query.
- Added assignment banner for assigned non-room-admin users.
- Quick actions filtered for cashier (bookings-focused).

---

## 4.4 Admin Hotels page scoping

### File changed: `src/routes/admin/hotels/index.tsx`

- Loads profile + assignment.
- `visibleHotels`:
  - all for room_admin,
  - assigned hotel only for scoped staff.
- `canAddHotel` only for room_admin.
- Cashier sees access denied state.
- Delete action hidden for non-room_admin.

---

## 4.5 Admin Rooms page scoping

### File changed: `src/routes/admin/rooms/index.tsx`

- Loads profile + assignment.
- Filters visible hotel list to assigned hotel for scoped staff.
- Cashier receives access denied state.

---

## 4.6 Admin Bookings page scoping

### File changed: `src/routes/admin/bookings/index.tsx`

- Loads profile + assignment.
- Non-room_admin auto-pinned to assigned hotel.
- Hotel selector constrained by visible hotels.
- Cancel action shown only when:
  - room_admin, or
  - hotel_admin.
- Cashier can view bookings in assigned hotel but cannot cancel.

---

## 4.7 Route registration

### File changed (generated): `src/routeTree.gen.ts`

- `/admin/users` route is now included in generated route types and route tree.

---

## 4.8 Post-login and authenticated redirects

### Files changed
- `src/routes/post-login.tsx`
- `src/routes/_authenticated.tsx`

Changes:
- Redirect logic now checks hotel assignment (`api.hotelStaff.getByUserId`) in addition to global role.
- Assigned staff (`hotel_admin` / `hotel_cashier`) are redirected to `/admin` after sign-in.

Why this matters:
- Fixed an issue where assigned staff were incorrectly sent to customer routes (`/select-location`) because only `room_admin` was being checked.

---

## 5) Permission Matrix (As Implemented)

| Capability | room_admin | hotel_admin (assigned hotel) | hotel_cashier (assigned hotel) | customer (unassigned) |
|---|---|---|---|---|
| Access `/admin` | ✅ | ✅ | ✅ | ❌ |
| See Hotels nav | ✅ | ✅ | ❌ | ❌ |
| See Rooms nav | ✅ | ✅ | ❌ | ❌ |
| See Bookings nav | ✅ | ✅ | ✅ | ❌ |
| See Users nav | ✅ | ❌ | ❌ | ❌ |
| Create hotel | ✅ | ❌ | ❌ | ❌ |
| Update/delete/restore hotel | ✅ | ✅ (own) | ❌ | ❌ |
| Create/update/delete/restore room | ✅ | ✅ (own hotel) | ❌ | ❌ |
| View hotel bookings | ✅ | ✅ (own hotel) | ✅ (own hotel) | ❌ |
| View hotel ratings (admin view) | ✅ | ✅ (own hotel) | ✅ (own hotel) | ❌ |
| Delete hotel ratings | ✅ | ✅ (own hotel) | ❌ | ❌ |
| Cancel booking (admin flow) | ✅ | ✅ (own hotel) | ❌ | self only |
| Assign/unassign hotel staff | ✅ | ❌ | ❌ | ❌ |

Notes:
- Owner self-cancel remains supported for normal customer flow.
- Room admin remains unrestricted even if also assigned in `hotelStaff`.

---

## 6) Deviations from Original Plan / Clarifications

1. `hotelStaff.getByUserId` currently requires `clerkUserId` and enforces scoped read rules (not globally public).
2. Cashier nav was implemented as **Bookings only** (not Dashboard + Bookings).
3. No new booking mutations were added for check-in/check-out/refund in this phase.
4. One-assignment-per-user is enforced in mutation logic, not DB uniqueness constraint.
5. Admin guard in route uses `beforeLoad` sign-in check and component-level profile/assignment authorization.
6. Post-login and authenticated redirects were updated after initial rollout to route assigned staff into admin flow.

---

## 7) Security and Consistency Considerations

- Backend checks were added to sensitive hotel/room/booking operations.
- Frontend filtering is now aligned with backend permissions for core flows.
- Audit trail now captures user-targeted staff assignment actions.
- Soft-deleted hotel validation blocks assigning staff to deleted hotels.

Potential hardening items:
- Add idempotent/transaction-safe assignment guard for concurrent assign races.
- Consider stricter access policy for `getByUserId` if same-hotel cross-view is undesired.

---

## 8) Validation Performed

- Convex typecheck and function sync completed successfully via `npx convex dev`.
- Project build completed successfully (`npm run build`).
- Lint/Type diagnostics were resolved for modified files.

---

## 9) Remaining / Deferred Work

1. Implement explicit booking lifecycle actions for staff:
   - check-in
   - check-out
   - refund processing
2. Add automated RBAC integration tests (backend + route-level).
3. Add operational metrics/stats scoped by assigned hotel.
4. Consider introducing route-level `beforeLoad` authorization helpers once profile context loading is centralized.

---

## 10) Final Outcome

The RBAC refactor is now in place with:
- scoped staff assignment model,
- enforceable backend authorization boundaries,
- admin users management UI,
- role-aware navigation and page-level data scoping,
- auditable assignment changes.

This implementation is production-ready for assignment, access, and scoped admin management workflows in the current MVP scope.
