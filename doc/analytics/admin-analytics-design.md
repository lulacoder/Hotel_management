# Admin Dashboard Analytics Design

## Overview

This design adds a live analytics layer to the admin dashboard so the current admin home becomes a real operational and business control center instead of a mostly static summary page. The feature builds on the existing admin entry route in `src/routes/admin/index.tsx` and derives analytics directly from current Convex data in `hotels`, `rooms`, `bookings`, and `hotelStaff`.

The first release uses live Convex queries rather than scheduled aggregates. This keeps the implementation simple, preserves the reactive experience already used in the app, and fits the current product need for a mixed dashboard with near real-time visibility.

## Goals

- Replace placeholder dashboard metrics with real analytics.
- Support role-based visibility:
  - `room_admin` sees system-wide analytics.
  - `hotel_admin` sees analytics for their assigned hotel only.
  - `hotel_cashier` sees a reduced analytics view for their assigned hotel.
- Provide a mixed dashboard with KPI cards, trends, distributions, and operational widgets.
- Support the selected time windows: `today`, `7 days`, and `30 days`.
- Keep analytics near real-time using live Convex queries.
- Allow drill-down from dashboard metrics into existing admin workflows where practical.

## Non-Goals

- No CSV or PDF export in the first release.
- No separate analytics/reporting module or standalone reporting pages in the first release.
- No scheduled rollup or warehouse-style aggregation pipeline.
- No historical backfill beyond what can be computed from the current data already stored in Convex.

## Product Decisions

### Chosen approach

Use a dedicated live analytics query layer in Convex. The dashboard UI calls analytics queries that compute KPI totals, trend series, status breakdowns, occupancy, and top-hotel rankings directly from existing application tables.

### Why this approach

- Best match for the current architecture and Convex usage model.
- Delivers near real-time updates without adding background jobs.
- Keeps implementation scope focused on the dashboard MVP.
- Leaves room to introduce cached or precomputed analytics later if query cost becomes a problem.

## Roles and Access Model

### `room_admin`

- Scope: all non-deleted hotels in one global view for MVP.
- Dashboard sections:
  - Full KPI set.
  - Revenue and booking trend charts.
  - Booking status and payment status distributions.
  - Room operational status distribution.
  - Occupancy trend.
  - Top hotels ranking table.

`room_admin` does not get a hotel selector in MVP. If hotel-specific investigation is needed, the user drills into hotel-oriented admin routes from rankings or existing hotel pages.

### `hotel_admin`

- Scope: assigned hotel only.
- Dashboard sections:
  - Hotel-scoped KPI set.
  - Revenue and booking trend charts.
  - Booking status, payment status, and room status distributions.
  - Occupancy trend.
  - No top-hotels ranking table.

### `hotel_cashier`

- Scope: assigned hotel only.
- Dashboard sections:
  - Reduced KPI set centered on bookings and payments.
  - Booking trend chart.
  - Payment status distribution.
  - Booking status distribution.
  - Today-focused operational counts.
  - No strategic multi-hotel ranking widgets.
  - No advanced room-management analytics unless already needed for booking workflows.

### Access enforcement

- All analytics functions derive caller identity from the JWT via existing Convex auth helpers.
- `room_admin` may request global analytics only in MVP.
- `hotel_admin` and `hotel_cashier` may request only their assigned hotel scope.
- Analytics queries must never accept unrestricted client-supplied scope that bypasses auth checks.

## Dashboard Information Architecture

### 1. KPI row

The top row should surface the fastest-glance metrics for the selected time window.

Recommended KPI cards for full views:

- Collected revenue.
- Total bookings.
- Active stays.
- Occupancy rate or available rooms.

Recommended KPI cards for cashier view:

- Collected revenue.
- Pending-payment bookings.
- Total bookings.
- Check-ins or arrivals today.

### 2. Trend section

Two primary line charts:

- Revenue over time.
- Bookings over time.

Behavior:

- `today`: hourly or coarse intraday buckets if feasible; otherwise a single-day summary with supporting counts.
- `7 days`: daily buckets.
- `30 days`: daily buckets.

If intraday computation for `today` adds too much complexity, the first release may use a daily summary card set for `today` while retaining charted trends for `7` and `30` days.

### 3. Distribution section

Status-based visualizations:

- Booking status distribution.
- Payment status distribution.
- Room operational status distribution.

Recommended visualization style:

- Horizontal bars or segmented bars for compact dashboard readability.

### 4. Occupancy section

Show occupancy trend for the selected scope and date window.

This section answers:

- How much inventory is occupied over time?
- Is availability tightening?
- Are operations facing short-term pressure?

### 5. Top hotels section

Visible only to `room_admin`.

Initial table columns:

- Hotel name.
- Revenue.
- Booking count.
- Occupancy rate.

Ranking default:

- Sort by revenue descending.

### 6. Drill-down behavior

Analytics remains a dashboard-first experience, but selected elements should link into existing admin pages.

Initial drill-down rules:

- Clicking booking-related KPI cards opens `admin/bookings` with the closest available filter state.
- Clicking booking status segments opens `admin/bookings` filtered by status.
- Clicking room status segments opens `admin/rooms` filtered by operational status if supported, or falls back to the rooms page with query-state preparation for later enhancement.
- Clicking a top-hotel row opens that hotel context in admin routes.

## Metric Definitions

All metric definitions must be explicit so product, frontend, and backend all implement the same logic.

## Time and Window Contract

To keep analytics implementation-safe with the current schema, every metric must declare its time source and window rule.

### Timezone rule

- All dashboard windows use UTC day boundaries in MVP.
- `today` means `00:00:00.000 UTC` through the current time.
- `7 days` means the trailing 7 UTC calendar days including today.
- `30 days` means the trailing 30 UTC calendar days including today.

If hotel-local timezone analytics become important later, that should be treated as a follow-up feature because the current schema does not store a hotel timezone.

### Window driver by metric family

- Booking creation metrics use `bookings.createdAt`.
- Revenue metrics use `bookings.createdAt` in MVP because the schema has payment status but no payment event timestamp.
- Arrival and departure operational metrics use `bookings.checkIn` and `bookings.checkOut`.
- Occupancy uses per-day overlap between stay dates and the requested UTC date buckets.
- Room operational status is a current snapshot and is not historical.

## Metric Contract Table

| Metric                      | Source                          | Window field                 | Type     | Definition                                                                                                                                                              |
| --------------------------- | ------------------------------- | ---------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total bookings              | `bookings`                      | `createdAt`                  | Windowed | Count bookings created inside the selected window and visible scope                                                                                                     |
| Booking trend               | `bookings`                      | `createdAt`                  | Windowed | Count bookings per bucket using booking creation time                                                                                                                   |
| Collected revenue           | `bookings`                      | `createdAt`                  | Windowed | Sum `totalPrice` for bookings created inside the selected window where `paymentStatus === 'paid'`                                                                       |
| Confirmed revenue pipeline  | `bookings`                      | `createdAt`                  | Windowed | Sum `totalPrice` for bookings created inside the selected window where status is `confirmed` or `checked_in` and `paymentStatus` is not `paid`, `failed`, or `refunded` |
| Active stays                | `bookings`                      | N/A                          | Snapshot | Count bookings with status `checked_in` at query time                                                                                                                   |
| Arrivals today              | `bookings`                      | `checkIn`                    | Windowed | Count bookings with `checkIn` equal to today's UTC date and status not in `cancelled`, `expired`                                                                        |
| Departures today            | `bookings`                      | `checkOut`                   | Windowed | Count bookings with `checkOut` equal to today's UTC date and status not in `cancelled`, `expired`                                                                       |
| Booking status distribution | `bookings`                      | `createdAt`                  | Windowed | Group bookings created inside the selected window by current booking status                                                                                             |
| Payment status distribution | `bookings`                      | `createdAt`                  | Windowed | Group bookings created inside the selected window by current payment status, treating missing payment status as `unpaid_unknown` in API output                          |
| Room operational status     | `rooms`                         | N/A                          | Snapshot | Group in-scope non-deleted rooms by current `operationalStatus`                                                                                                         |
| Occupancy trend             | `rooms` + `bookings`            | `checkIn`/`checkOut` overlap | Windowed | Daily occupied-room ratio using in-scope room inventory and booking overlap rules                                                                                       |
| Top hotels                  | `hotels` + `bookings` + `rooms` | `createdAt` for bookings     | Windowed | Rank non-deleted hotels by collected revenue, with booking count and occupancy included                                                                                 |

### Revenue

Because the chosen business rule is `confirmed + paid`, the dashboard should expose two related concepts instead of collapsing them into one ambiguous number.

- `Collected revenue`:
  - Sum of `bookings.totalPrice` where `paymentStatus === 'paid'` and `createdAt` falls inside the selected window.
- `Confirmed revenue pipeline`:
  - Sum of `bookings.totalPrice` where `createdAt` falls inside the selected window, booking status is `confirmed` or `checked_in`, and `paymentStatus` is missing or `pending`.
- `Primary dashboard revenue card`:
  - Show collected revenue by default.
- Supporting context:
  - Show pending confirmed revenue nearby so admins understand actual versus expected revenue.

This avoids mixing true collected cash with projected operational value, while remaining implementable without a payment timestamp table.

### Bookings

- `Total bookings`:
  - Count bookings created in the selected time window.
- `Active stays`:
  - Count bookings currently in `checked_in`.
- `Arrivals today`:
  - Count bookings where `checkIn` is today and status is not cancelled/expired.
- `Departures today`:
  - Count bookings where `checkOut` is today and status is not cancelled/expired.

### Booking status distribution

Use existing statuses from schema:

- `held`
- `pending_payment`
- `confirmed`
- `checked_in`
- `checked_out`
- `cancelled`
- `expired`
- `outsourced`

For dashboard readability, the UI may group some statuses later, but the analytics API should return the raw status counts for bookings created inside the selected window.

### Payment status distribution

Use current payment statuses:

- `pending`
- `paid`
- `failed`
- `refunded`

Bookings with no `paymentStatus` should be returned under a synthetic API bucket such as `unpaid_unknown` so the dashboard does not silently drop them.

### Occupancy

Initial occupancy definition:

- Numerator: number of non-deleted, in-scope rooms with at least one overlapping booking for a given day where booking status is one of `confirmed`, `checked_in`, or `checked_out`.
- Denominator: total non-deleted, in-scope rooms whose `operationalStatus` is not `out_of_order`.

Occupancy rate:

- `occupiedRooms / totalRooms`

Additional rules:

- `maintenance` and `cleaning` rooms remain in the denominator for MVP because they are still part of managed inventory and the schema lacks historical room-state tracking.
- `out_of_order` rooms are excluded from the denominator.
- Occupancy uses date overlap logic against each UTC day bucket, not booking creation time.

This is a booking-based occupancy view, not an operational status-only view.

### Room status distribution

Use `rooms.operationalStatus` values:

- `available`
- `maintenance`
- `cleaning`
- `out_of_order`

## Data Sources

The first release should compute analytics from existing tables only.

- `hotels`: scope, rankings, hotel counts.
- `rooms`: inventory totals, operational status breakdown, occupancy denominator.
- `bookings`: revenue, trends, status distributions, occupancy numerator, arrivals/departures.
- `hotelStaff`: role-based scope resolution.

## Data Hygiene Rules

- Exclude `isDeleted === true` hotels from all dashboard analytics and rankings.
- Exclude `isDeleted === true` rooms from all room inventory, occupancy, and room-status metrics.
- Exclude bookings tied to deleted hotels from analytics output in MVP.
- Exclude bookings tied to deleted rooms from occupancy and room-inventory metrics in MVP.

This means MVP analytics reflects currently active inventory and currently active hotels, not archival reporting.

## Backend Design

### New Convex analytics module

Create a dedicated module such as `convex/analytics.ts` with small focused queries rather than a single oversized function.

Recommended queries:

- `getDashboardSummary`
  - Returns KPI cards for the selected scope and time window.
- `getRevenueTrend`
  - Returns revenue series for the selected time window.
- `getBookingTrend`
  - Returns booking count series for the selected time window.
- `getStatusBreakdowns`
  - Returns booking, payment, and room status counts.
- `getOccupancyTrend`
  - Returns daily occupancy series.
- `getTopHotels`
  - Global-only query for `room_admin` rankings.

An alternative is one composite query plus one rankings query, but smaller queries are preferred because they keep return types focused, let the UI load sections independently, and reduce the blast radius of future changes.

### Query inputs

Shared inputs should remain small and validated:

- `window`: `'today' | '7d' | '30d'`

Avoid freeform custom date ranges in MVP because the chosen product scope does not require them.

### Auth pattern

Every analytics query should:

- Resolve the current user with existing auth helpers.
- Resolve hotel assignment when the caller is not `room_admin`.
- Enforce allowed scope server-side.

### Performance strategy

The live-query approach is acceptable for MVP, but analytics queries should still be written defensively.

Initial guidance:

- Filter by hotel when possible before joining or enriching.
- Keep time windows limited to `today`, `7d`, and `30d`.
- Return only dashboard-ready data, not large raw booking lists.
- Reuse helper functions for date-window calculations and scoped record filtering.
- If a query becomes expensive later, move that specific metric to a cached aggregate instead of redesigning the whole dashboard.

### Index expectations

The implementation plan should evaluate adding analytics-friendly indexes on `bookings` because windowed dashboard queries will be common.

Likely candidates:

- `by_created_at`
- `by_hotel_and_created_at`
- `by_hotel_and_check_in`
- `by_hotel_and_check_out`

If dataset size is still small, MVP may begin with bounded scans for some metrics, but this should be treated as an explicit tradeoff rather than an invisible assumption.

## Frontend Design

### Route strategy

Keep analytics inside `src/routes/admin/index.tsx` for the first release. This preserves the existing mental model that the admin home is the main dashboard.

### Frontend composition

Refactor the current dashboard page into focused dashboard components, for example:

- KPI cards section
- Trends section
- Distribution widgets section
- Occupancy section
- Top hotels table
- Reduced cashier view wrapper

This avoids turning `src/routes/admin/index.tsx` into a large monolith.

### Filter controls

Provide a lightweight time-window switcher:

- `Today`
- `7 days`
- `30 days`

Persist the selected window in URL search params so drill-down behavior remains stable.

### Loading states

Each dashboard section should support independent loading and empty states. This is preferable to blocking the whole dashboard on one large analytics request.

### Role-based rendering

- `room_admin`: full dashboard including top hotels.
- `hotel_admin`: full hotel-scoped dashboard without cross-hotel ranking.
- `hotel_cashier`: reduced dashboard emphasizing bookings and payments.

## UX Behavior

- Dashboard should open with a sensible default time window, preferably `7 days`.
- Cards and charts should clearly label whether values are collected revenue, pending revenue, or booking volume.
- Reduced cashier view should avoid strategic clutter and keep actions close to operational work.
- Empty states should be explicit when a hotel has no bookings or little history.

## Drill-Down Route Contract

To make drill-down implementation-safe, the dashboard should target explicit search-param contracts.

### Bookings page

Target route: `/admin/bookings`

Proposed search params:

- `status?`
- `paymentStatus?`
- `window?` where value is `today | 7d | 30d`

Adding `paymentStatus` and `window` support to `/admin/bookings` is part of MVP Phase 1 because booking-oriented drill-down is a selected core interaction, not a post-MVP enhancement.

For hotel-scoped users, hotel filtering comes from existing auth scope. For `room_admin`, the MVP drill-down remains global because the dashboard itself is global.

### Rooms page

Target route: `/admin/rooms`

Proposed search params:

- `operationalStatus?`
- `window?` only when needed for context preservation

Adding `operationalStatus` support to `/admin/rooms` is preferred for MVP Phase 1. If it proves too disruptive during implementation, the fallback is plain navigation to `/admin/rooms`, but that fallback should be treated as a scoped compromise rather than the target design.

## Error Handling

- Unauthorized scope requests return structured Convex auth/domain errors.
- If hotel assignment is missing for hotel-scoped users, the frontend should show the existing access/assignment messaging pattern.
- If a section cannot load, the failure should degrade locally rather than blanking the entire dashboard.

## Testing Strategy

### Backend

- Unit-style query tests for metric calculation helpers.
- Auth tests covering `room_admin`, `hotel_admin`, and `hotel_cashier` access.
- Window tests for `today`, `7d`, and `30d`.
- Metric-definition tests for revenue, occupancy, and status breakdowns.

### Frontend

- Rendering tests for role-based sections.
- Loading and empty-state tests.
- Interaction tests for time-window switching.
- Drill-down navigation tests where routes already support filters.

## Rollout Plan

### Phase 1

- Implement live analytics Convex queries.
- Replace placeholder admin dashboard stats.
- Add time-window switcher.
- Persist selected dashboard window in URL search params.
- Add trend charts, status widgets, occupancy, and top hotels.
- Add reduced cashier view.
- Add booking drill-down search-param support for `status`, `paymentStatus`, and `window`.
- Prefer room drill-down search-param support for `operationalStatus`.

### Phase 2

- Improve drill-down filtering in bookings and rooms pages.
- Tune expensive queries if needed.

### Phase 3

- Consider exports or cached aggregates only after real usage shows a need.

## Open Implementation Notes

- The current schema does not expose a dedicated finalized-revenue event table, so revenue remains booking-derived in MVP.
- `today` trend granularity may start simpler than `7d` and `30d` if intraday buckets complicate delivery.
- Occupancy calculations should be centralized in shared helpers to avoid inconsistent frontend/backend math.

## Acceptance Criteria

- Admin dashboard shows live analytics instead of placeholders.
- Time-window switching supports `today`, `7 days`, and `30 days`.
- The primary revenue KPI is labeled and computed as collected revenue, with pending confirmed revenue shown as secondary context.
- `room_admin` sees global analytics and top-hotels ranking.
- `hotel_admin` sees assigned-hotel analytics only.
- `hotel_cashier` sees a reduced assigned-hotel analytics view.
- Revenue is presented with a clear distinction between collected and pending confirmed value.
- Users can drill from key metrics into existing admin management views where supported.
- MVP supports either an intraday `today` trend or a clearly labeled `today` summary view, while `7 days` and `30 days` provide charted trends.
- Analytics data updates through normal Convex reactivity without requiring manual export or scheduled jobs.
