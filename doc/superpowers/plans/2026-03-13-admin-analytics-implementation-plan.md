# Admin Dashboard Analytics Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live, role-aware analytics dashboard on the existing admin home with Convex-backed KPIs, trends, breakdowns, occupancy, and drill-down navigation, while keeping hotel cashiers fully excluded from revenue analytics.

**Architecture:** Add a focused Convex analytics query layer backed by small helper modules for UTC windows, metric aggregation, scope resolution, and response shaping. Refactor the admin dashboard into reusable analytics components, persist the selected time window in route search params, extend bookings and rooms routes for drill-downs, and deploy Convex changes with a one-shot `npx convex dev --once` sync instead of a long-running dev session.

**Tech Stack:** TypeScript, Convex, TanStack Start/Router, React 19, Tailwind CSS

---

## User Preferences Locked Into This Plan

- Do not write automated tests for this feature.
- Do not create git commits as part of this work.
- Hotel cashiers must not see revenue-related information anywhere in the admin analytics experience.
- Use `npx convex dev --once` to sync schema/function changes to Convex.

## File Structure

### Backend files

- Create: `convex/lib/adminAnalyticsWindow.ts`
  - UTC window math, bucket generation, day keys, and date-overlap helpers.
- Create: `convex/lib/adminAnalyticsMetrics.ts`
  - Pure aggregation helpers for counts, revenue, trends, room status, occupancy, and rankings.
- Create: `convex/lib/adminAnalyticsScope.ts`
  - Shared role/scope helpers used by analytics queries.
- Create: `convex/lib/adminAnalyticsQueryBuilders.ts`
  - Response-shaping helpers so query handlers stay small and consistent.
- Create: `convex/analytics.ts`
  - Public Convex queries for dashboard summary, revenue trend, booking trend, breakdowns, occupancy, and top hotels.
- Modify: `convex/schema.ts`
  - Add analytics-friendly indexes for bookings.

### Frontend files

- Create: `src/lib/adminAnalytics.ts`
  - Shared window/search helpers and analytics UI labels.
- Create: `src/components/admin-analytics/AnalyticsTimeWindowTabs.tsx`
- Create: `src/components/admin-analytics/AnalyticsMetricCard.tsx`
- Create: `src/components/admin-analytics/AnalyticsTrendChart.tsx`
- Create: `src/components/admin-analytics/AnalyticsStatusBreakdown.tsx`
- Create: `src/components/admin-analytics/AnalyticsOccupancyCard.tsx`
- Create: `src/components/admin-analytics/AnalyticsTopHotelsTable.tsx`
- Create: `src/components/admin-analytics/CashierAnalyticsPanel.tsx`
- Create: `src/components/admin-analytics/AnalyticsEmptyState.tsx`
- Modify: `src/routes/admin/index.tsx`
  - Replace placeholder stats with live analytics sections and role-based rendering.
- Modify: `src/routes/admin/bookings/index.tsx`
  - Add search-param support for `status`, `paymentStatus`, and `window`.
- Modify: `src/routes/admin/rooms/index.tsx`
  - Add search-param support for `operationalStatus` and `window`, plus analytics-origin filter context.
- Modify: `src/routes/admin/hotels/$hotelId.tsx`
  - Optionally consume preserved analytics-origin room filter context if useful.
- Modify: `src/lib/i18n/messages.ts`
  - Add analytics labels and empty-state copy in both locales.

### Generated / do-not-edit files

- Do not edit `convex/_generated/*` manually.
- Do not edit `src/routeTree.gen.ts` manually.

## Implementation Notes Before Starting

- Use manual verification and build/lint checks instead of automated tests.
- Keep analytics query outputs dashboard-ready; do not send raw booking arrays to the dashboard route.
- Use UTC consistently. Reuse `convex/lib/dates.ts` utilities where possible.
- Prefer lightweight SVG/Tailwind chart rendering over adding a chart dependency.
- Do not create commits while implementing this plan.

## Chunk 1: Backend Analytics Foundation

### Task 1: Add UTC analytics window helpers

**Files:**

- Create: `convex/lib/adminAnalyticsWindow.ts`

- [ ] **Step 1: Create the analytics window module**

Create `convex/lib/adminAnalyticsWindow.ts` with these exports:

- `export type AnalyticsWindow = 'today' | '7d' | '30d'`
- `getAnalyticsWindowRange(window: AnalyticsWindow, nowMs = Date.now())`
- `buildWindowBuckets(window: AnalyticsWindow, nowMs = Date.now())`
- `isTimestampInWindow(timestamp: number, range)`
- `getUtcDateKey(value: Date | number): string`
- `enumerateStayDates(checkIn: string, checkOut: string): string[]`
- `doesStayOverlapDate(checkIn: string, checkOut: string, dateKey: string): boolean`

- [ ] **Step 2: Implement UTC window rules exactly as defined in the spec**

Required behavior:

- `today` starts at `00:00:00.000 UTC` and ends at `now`
- `7d` includes today plus the previous 6 UTC calendar days
- `30d` includes today plus the previous 29 UTC calendar days
- bucket type is hourly/coarse for `today`, daily for `7d` and `30d`

- [ ] **Step 3: Reuse date helpers from `convex/lib/dates.ts`**

When working with `YYYY-MM-DD` strings, use `parseDate` and `formatDate` instead of reimplementing parsing.

- [ ] **Step 4: Manually verify helper behavior in code review**

Before moving on, confirm from the implementation itself that:

- a `7d` window ending on `2026-03-13` starts on `2026-03-07`
- `enumerateStayDates('2026-03-10', '2026-03-12')` yields `['2026-03-10', '2026-03-11']`
- overlap logic treats `checkOut` as non-inclusive for occupancy

### Task 2: Add pure analytics metric helpers

**Files:**

- Create: `convex/lib/adminAnalyticsMetrics.ts`

- [ ] **Step 1: Define exact helper input/output types**

Create focused types such as:

- `AnalyticsBookingRecord`
- `AnalyticsRoomRecord`
- `AnalyticsHotelRecord`
- `TrendPoint`
- `OccupancyPoint`
- `TopHotelRanking`

Keep them limited to the fields required by the analytics spec.

- [ ] **Step 2: Implement KPI and breakdown helpers**

Implement helpers for:

- `calculateCollectedRevenue`
- `calculateConfirmedRevenuePipeline`
- `countActiveStays`
- `countArrivalsForDate`
- `countDeparturesForDate`
- `countPendingPaymentBookings`
- `buildBookingStatusCounts`
- `buildPaymentStatusCounts`
- `buildRoomStatusCounts`

Required rules:

- active stays count only `checked_in`
- arrivals/departures exclude `cancelled` and `expired`
- missing `paymentStatus` maps to `unpaid_unknown`
- revenue pipeline includes `confirmed` and `checked_in` when payment is missing or `pending`
- revenue pipeline excludes `paid`, `failed`, and `refunded`

- [ ] **Step 3: Implement trend and occupancy helpers**

Implement:

- `buildRevenueTrendSeries`
- `buildBookingTrendSeries`
- `buildOccupancyTrendSeries`
- `buildTopHotelRankings`

Required rules:

- revenue trend uses paid bookings only
- booking trend groups by `createdAt`
- occupancy numerator includes only `confirmed`, `checked_in`, and `checked_out`
- occupancy excludes deleted rooms and deleted-room bookings
- occupancy denominator excludes `out_of_order`
- occupancy denominator still includes `maintenance` and `cleaning`
- deleted hotels are excluded from rankings

- [ ] **Step 4: Manually verify metric logic against a small fixture table**

Use this mental/manual fixture while reading the implementation:

- active hotels: hotel A, hotel B
- deleted hotel: hotel deleted
- hotel A rooms: available, maintenance, out_of_order, deleted room
- hotel B rooms: available
- in-window bookings:
  - hotel A paid confirmed
  - hotel A unpaid confirmed
  - hotel A checked_in unpaid
  - hotel A cancelled
  - hotel B paid confirmed
- excluded records:
  - deleted-hotel booking
  - deleted-room booking for occupancy

Expected outcomes from that fixture:

- global collected revenue = hotel A paid + hotel B paid
- hotel A pending-payment bookings = 2
- hotel A active stays = 1
- global occupancy = 2 occupied / 3 total usable rooms
- hotel A occupancy = 2 occupied / 2 total usable rooms

### Task 3: Add analytics scope and response-shaping helpers

**Files:**

- Create: `convex/lib/adminAnalyticsScope.ts`
- Create: `convex/lib/adminAnalyticsQueryBuilders.ts`

- [ ] **Step 1: Implement scope resolution helper**

In `convex/lib/adminAnalyticsScope.ts`, add a helper such as `resolveAnalyticsScope` that:

- returns global scope for `room_admin`
- returns assigned-hotel scope for `hotel_admin`
- returns assigned-hotel scope for `hotel_cashier`
- throws `ConvexError({ code: 'FORBIDDEN' })` if a hotel-scoped user lacks an assignment

- [ ] **Step 2: Define exact response shapes in the query-builder module**

In `convex/lib/adminAnalyticsQueryBuilders.ts`, define response builders for:

- `buildDashboardSummaryResponse`
- `buildTrendResponse`
- `buildStatusBreakdownsResponse`
- `buildOccupancyTrendResponse`
- `buildTopHotelsResponse`

These builders should shape backend metric results into the exact payloads consumed by the frontend.

- [ ] **Step 3: Lock down cashier-visible summary content**

Cashier summary must include only non-revenue KPI cards:

- `pendingPaymentBookings`
- `totalBookings`
- `arrivalsToday`
- `activeStays`

Cashier summary must not include:

- `collectedRevenue`
- `confirmedRevenuePipeline`
- revenue secondary context

### Task 4: Add Convex analytics queries and schema indexes

**Files:**

- Create: `convex/analytics.ts`
- Modify: `convex/schema.ts`

- [ ] **Step 1: Implement shared Convex validators**

In `convex/analytics.ts`, define:

- `analyticsWindowValidator`
- metric-card validator
- trend-point validator
- status-count validator
- occupancy-point validator
- top-hotel validator

Keep all queries compliant with the repo rule that Convex functions define both `args` and `returns`.

- [ ] **Step 2: Implement `getDashboardSummary`**

Requirements:

- use `requireUser` and existing auth helpers from `convex/lib/auth.ts`
- derive scope through `resolveAnalyticsScope`
- exclude deleted hotels from all analytics
- exclude deleted rooms and deleted-room bookings only from room-status and occupancy-related metrics
- return full KPI sets for `room_admin` and `hotel_admin`
- return cashier KPI set with no revenue fields for `hotel_cashier`

Role mapping:

- `room_admin`: `collectedRevenue`, `totalBookings`, `activeStays`, `occupancyRate`, plus `confirmedRevenuePipeline` as secondary context on the revenue card
- `hotel_admin`: `collectedRevenue`, `totalBookings`, `activeStays`, `occupancyRate`, plus `confirmedRevenuePipeline` as secondary context on the revenue card
- `hotel_cashier`: `pendingPaymentBookings`, `totalBookings`, `arrivalsToday`, `activeStays`

- [ ] **Step 3: Implement `getRevenueTrend`**

Requirements:

- available only to `room_admin` and `hotel_admin`
- not called or displayed for `hotel_cashier`
- windowed by the selected analytics window
- grouped by `buildWindowBuckets`

- [ ] **Step 4: Implement `getBookingTrend`**

Requirements:

- available to all admin roles
- grouped by booking `createdAt`
- hotel-scoped users only see their assigned hotel

- [ ] **Step 5: Implement `getStatusBreakdowns`**

Requirements:

- booking status distribution is windowed by `createdAt`
- payment status distribution uses `unpaid_unknown` for missing values
- room status distribution is a current snapshot
- cashier responses must omit room-status analytics entirely

- [ ] **Step 6: Implement `getOccupancyTrend`**

Requirements:

- available to `room_admin` and `hotel_admin`
- not shown to `hotel_cashier`
- uses booking overlap and usable room inventory rules from the spec

- [ ] **Step 7: Implement `getTopHotels`**

Requirements:

- global-only access for `room_admin`
- `hotel_admin` and `hotel_cashier` receive `ConvexError({ code: 'FORBIDDEN' })`
- exclude deleted hotels
- sort by collected revenue descending

- [ ] **Step 8: Add analytics-friendly indexes to `convex/schema.ts`**

Add these indexes on the `bookings` table:

```ts
.index('by_created_at', ['createdAt'])
.index('by_hotel_and_created_at', ['hotelId', 'createdAt'])
.index('by_hotel_and_check_in', ['hotelId', 'checkIn'])
.index('by_hotel_and_check_out', ['hotelId', 'checkOut'])
```

- [ ] **Step 9: Deploy Convex changes once**

Run:

```bash
npx convex dev --once
```

Expected:

- schema sync succeeds
- new analytics functions deploy successfully
- generated Convex files update automatically without manual edits

- [ ] **Step 10: Manually verify backend query behavior**

Confirm with seeded/local data or the Convex dashboard that:

- `room_admin` sees global summary and top hotels
- `hotel_admin` sees only assigned-hotel summary
- `hotel_cashier` sees assigned-hotel summary with no revenue fields
- `getTopHotels` rejects `hotel_admin` and `hotel_cashier`
- deleted hotel data never appears in analytics output

## Chunk 2: Frontend Dashboard and Drill-Down Integration

### Task 5: Add frontend analytics helpers

**Files:**

- Create: `src/lib/adminAnalytics.ts`

- [ ] **Step 1: Create shared frontend analytics helpers**

Add:

- `type AnalyticsWindow = 'today' | '7d' | '30d'`
- `normalizeAnalyticsWindow(value: unknown): AnalyticsWindow`
- `analyticsWindowOptions`
- `getAnalyticsWindowLabel`
- `normalizeBookingStatusFilter`
- `normalizePaymentStatusFilter`
- `normalizeRoomOperationalStatusFilter`

- [ ] **Step 2: Keep route-search parsing centralized**

All analytics-related `validateSearch` blocks should use these helpers instead of duplicating string checks inside route files.

### Task 6: Build reusable analytics components

**Files:**

- Create: `src/components/admin-analytics/AnalyticsTimeWindowTabs.tsx`
- Create: `src/components/admin-analytics/AnalyticsMetricCard.tsx`
- Create: `src/components/admin-analytics/AnalyticsTrendChart.tsx`
- Create: `src/components/admin-analytics/AnalyticsStatusBreakdown.tsx`
- Create: `src/components/admin-analytics/AnalyticsOccupancyCard.tsx`
- Create: `src/components/admin-analytics/AnalyticsTopHotelsTable.tsx`
- Create: `src/components/admin-analytics/CashierAnalyticsPanel.tsx`
- Create: `src/components/admin-analytics/AnalyticsEmptyState.tsx`

- [ ] **Step 1: Create the window-switcher and metric-card components**

Required behavior:

- time-window tabs render `Today`, `7 days`, `30 days`
- the active window is visually distinct
- metric cards support optional click behavior for drill-downs
- metric cards support optional secondary context for non-cashier revenue cards

- [ ] **Step 2: Create trend, breakdown, occupancy, and top-hotels components**

Required behavior:

- `AnalyticsTrendChart` renders lightweight SVG-based lines or bars
- `AnalyticsStatusBreakdown` renders click-target rows/segments
- `AnalyticsOccupancyCard` renders daily occupancy values
- `AnalyticsTopHotelsTable` renders these columns in order: `Hotel name`, `Revenue`, `Booking count`, `Occupancy rate`
- `AnalyticsTopHotelsTable` preserves revenue-desc ranking from the backend
- `AnalyticsTopHotelsTable` supports clickable rows via `onHotelClick(hotelId)`

- [ ] **Step 3: Create the cashier panel with explicit visibility rules**

`CashierAnalyticsPanel` must render only:

- KPI cards for `pendingPaymentBookings`, `totalBookings`, `arrivalsToday`, `activeStays`
- booking trend
- payment status breakdown
- booking status breakdown

`CashierAnalyticsPanel` must not render:

- revenue KPI cards
- revenue trend
- confirmed revenue pipeline context
- top hotels
- room status analytics
- occupancy analytics

- [ ] **Step 4: Add reusable local state surfaces**

Each component section should support:

- local loading UI
- local empty UI via `AnalyticsEmptyState`
- local fallback UI if its data is unavailable

The dashboard must not blank the entire page because one analytics section fails.

### Task 7: Replace placeholder admin dashboard with live analytics

**Files:**

- Modify: `src/routes/admin/index.tsx`
- Modify: `src/lib/i18n/messages.ts`

- [ ] **Step 1: Add dashboard route search parsing**

Update `createFileRoute('/admin/')` to validate and normalize the `window` search param using `normalizeAnalyticsWindow`.

Required behavior:

- missing `window` defaults to `7d`
- invalid `window` values normalize to `7d`

- [ ] **Step 2: Wire analytics queries into the dashboard route**

Use the normalized window to query:

- `api.analytics.getDashboardSummary`
- `api.analytics.getBookingTrend`
- `api.analytics.getStatusBreakdowns`
- `api.analytics.getRevenueTrend` only for `room_admin` and `hotel_admin`
- `api.analytics.getOccupancyTrend` only for `room_admin` and `hotel_admin`
- `api.analytics.getTopHotels` only for `room_admin`

Cashier-safety rule:

- cashier dashboard state must only retain cashier-safe fields from `getDashboardSummary`, `getBookingTrend`, and cashier-allowed breakdowns
- do not fetch, store, or pass revenue trend, occupancy, top-hotels, or revenue summary fields into cashier rendering paths

- [ ] **Step 3: Render role-aware dashboard sections**

Required rendering rules:

- replace the placeholder stats from the current dashboard
- keep quick actions below analytics
- `room_admin` shows full dashboard including top hotels
- `hotel_admin` shows hotel-scoped dashboard without top hotels
- `hotel_cashier` shows `CashierAnalyticsPanel` only

- [ ] **Step 4: Preserve cashier revenue exclusion end-to-end**

Confirm in code that cashier flows never render:

- collected revenue
- total revenue wording
- confirmed revenue pipeline
- revenue charts

This rule applies to cards, charts, helper text, badges, and drill-downs.

- [ ] **Step 5: Keep access and failure behavior aligned with existing admin UX**

Reuse the existing access/assignment messaging pattern from `src/routes/admin.tsx` if a hotel-scoped user lacks assignment access.

Also ensure:

- summary section can fail locally without hiding quick actions
- trends can fail locally without hiding summary cards
- top hotels can fail locally without hiding the rest of the dashboard

- [ ] **Step 6: Add analytics translations in both locale branches**

Update both locale objects in `src/lib/i18n/messages.ts` with analytics keys such as:

- `admin.analytics.pendingPaymentBookings`
- `admin.analytics.totalBookings`
- `admin.analytics.arrivalsToday`
- `admin.analytics.activeStays`
- `admin.analytics.collectedRevenue`
- `admin.analytics.confirmedPipeline`
- `admin.analytics.bookingTrend`
- `admin.analytics.revenueTrend`
- `admin.analytics.topHotels`
- `admin.analytics.noData`
- `admin.analytics.sectionUnavailable`

Reuse existing booking and room status translation keys where possible.

- [ ] **Step 7: Manually verify role behavior in the browser**

Run:

```bash
npm run dev
```

Check:

- `/admin?window=7d` as `room_admin`
- `/admin?window=today` as `hotel_admin`
- `/admin?window=30d` as `hotel_cashier`
- `/admin` with no `window` value
- `/admin?window=weird` with an invalid value

Expected:

- the selected window persists in the URL
- missing or invalid `window` resolves to `7d`
- the correct role-specific sections appear
- cashier sees no revenue information anywhere

### Task 8: Add bookings, rooms, and top-hotels drill-down behavior

**Files:**

- Modify: `src/routes/admin/index.tsx`
- Modify: `src/routes/admin/bookings/index.tsx`
- Modify: `src/routes/admin/rooms/index.tsx`
- Modify: `src/routes/admin/hotels/$hotelId.tsx`

- [ ] **Step 1: Add bookings route search-param support**

Update `createFileRoute('/admin/bookings/')` to support:

```ts
{
  status: 'all' |
    'held' |
    'pending_payment' |
    'confirmed' |
    'checked_in' |
    'checked_out' |
    'cancelled' |
    'expired' |
    'outsourced'
  paymentStatus: 'all' |
    'pending' |
    'paid' |
    'failed' |
    'refunded' |
    'unpaid_unknown'
  window: 'today' | '7d' | '30d'
}
```

The route must hydrate visible controls from `Route.useSearch()` and filter the displayed data consistently.

- [ ] **Step 2: Add rooms route search-param support**

Update `createFileRoute('/admin/rooms/')` to support:

```ts
{
  operationalStatus: 'all' |
    'available' |
    'maintenance' |
    'cleaning' |
    'out_of_order'
  window: 'today' | '7d' | '30d'
}
```

Exact MVP behavior:

- show a pinned analytics-origin filter chip/notice when `operationalStatus !== 'all'`
- preserve analytics-origin context when the user navigates deeper into room-management flows
- if deeper room filtering is not implemented yet, the source filter must still be visible on `/admin/rooms`

- [ ] **Step 3: Wire dashboard booking drill-downs**

Use explicit search objects from dashboard widgets, for example:

```tsx
to="/admin/bookings"
search={{ status: 'confirmed', paymentStatus: 'all', window }}
```

and

```tsx
to="/admin/bookings"
search={{ status: 'all', paymentStatus: 'pending', window }}
```

- [ ] **Step 4: Wire dashboard rooms drill-downs**

Use explicit search objects such as:

```tsx
to="/admin/rooms"
search={{ operationalStatus: 'maintenance', window }}
```

- [ ] **Step 5: Wire top-hotels row drill-downs**

When `room_admin` clicks a top-hotel row, navigate to:

```tsx
to="/admin/hotels/$hotelId"
params={{ hotelId }}
```

- [ ] **Step 6: Manually verify drill-down behavior**

Run:

```bash
npm run dev
```

Expected:

- bookings drill-downs open with visible filter state
- rooms drill-downs open with visible analytics-origin status context
- top-hotels rows open the correct hotel admin page
- cashier drill-downs never route to revenue-related widgets because none are rendered

### Task 9: Final verification and Convex sync confirmation

**Files:**

- No new files

- [ ] **Step 1: Run build verification**

Run:

```bash
npm run build
```

Expected: production build succeeds.

- [ ] **Step 2: Run lint verification**

Run:

```bash
npm run lint
```

Expected: lint succeeds.

- [ ] **Step 3: Re-run one-shot Convex sync after final backend changes if needed**

Run:

```bash
npx convex dev --once
```

Expected: Convex deployment is up to date with final schema/function changes.

- [ ] **Step 4: Final manual QA sweep**

Verify all of the following:

- admin dashboard loads for all supported admin roles
- top hotels shows only for `room_admin`
- `hotel_admin` sees hotel-scoped analytics only
- `hotel_cashier` sees bookings/payment operations only and no revenue content at all
- bookings and rooms drill-down filters stay visible after navigation
- quick actions remain available even if one analytics section has no data or fails

## Plan Review Checklist

- No automated tests are added.
- No commit steps are included.
- Cashier pages exclude all revenue-related information.
- Convex changes are synced with `npx convex dev --once`.
- Search params are parsed through shared helpers.
- `convex/_generated/*` and `src/routeTree.gen.ts` are never edited manually.

## Final Verification

- Run: `npx convex dev --once`
- Run: `npm run build`
- Run: `npm run lint`
- Manual QA:
  - `/admin?window=7d` for `room_admin`
  - `/admin?window=today` for `hotel_admin`
  - `/admin?window=30d` for `hotel_cashier`
  - drill into `/admin/bookings`, `/admin/rooms`, and `/admin/hotels/$hotelId` from analytics widgets

Plan complete and saved to `doc/superpowers/plans/2026-03-13-admin-analytics-implementation-plan.md`. Ready to execute?
