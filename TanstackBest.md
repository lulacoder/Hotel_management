# TanStack Start + Convex Refactor Notes

This document explains the main changes made in this session, why they were made, and what they improve.

## Goals of This Refactor

The main focus of this pass was to make the TanStack Start app more predictable, more type-safe, and less dependent on redirect logic inside React components.

The work focused on:

- moving auth and role redirects into TanStack Router route guards
- standardizing typed route search params
- splitting a large hotel detail route into smaller parts
- reducing some Convex query N+1 patterns
- improving router defaults and generated-file lint ergonomics
- fixing TanStack route-file warnings for helper components

## 1. Router Foundation Improvements

### Typed router context

The router now uses a real typed context instead of a placeholder empty object.

Files:

- [src/lib/routerContext.ts](C:/Users/hp/hotel-management/hotel_management/src/lib/routerContext.ts)
- [src/routes/__root.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/__root.tsx)
- [src/router.tsx](C:/Users/hp/hotel-management/hotel_management/src/router.tsx)

What changed:

- added `AppRouterContext`
- wired the root route with `createRootRouteWithContext<AppRouterContext>()`
- updated the router setup to use `createRouterContext()`
- kept TanStack Router defaults aligned with a live-cache app:
  - `scrollRestoration: true`
  - `defaultPreload: 'intent'`
  - `defaultPreloadStaleTime: 0`

Why this matters:

- route guards can now read live auth information through router context
- the router remains stable instead of being recreated around auth changes
- navigation feels faster and less jumpy

## 2. Shared Auth and Search Utilities

Files:

- [src/lib/authRouting.ts](C:/Users/hp/hotel-management/hotel_management/src/lib/authRouting.ts)
- [src/lib/navigationSearch.ts](C:/Users/hp/hotel-management/hotel_management/src/lib/navigationSearch.ts)

What changed:

- added shared redirect sanitization helpers
- added shared auth snapshot helpers
- added canonical default search objects for routes that now require typed search

Examples:

- auth routes now share one `redirect` shape
- `/admin` has a stable default dashboard search
- `/select-location` has a stable canonical search object
- `/hotels/$hotelId` has a stable hotel-detail search shape

Why this matters:

- avoids ad hoc `URLSearchParams` parsing
- avoids inconsistent redirect behavior
- makes TanStack typed navigation happy everywhere

## 3. Auth and Role Guards Moved Into `beforeLoad`

Files:

- [src/routes/_authenticated.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/_authenticated.tsx)
- [src/routes/admin.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/admin.tsx)
- [src/routes/post-login.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/post-login.tsx)
- [src/routes/sign-in.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/sign-in.tsx)
- [src/routes/sign-in.$.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/sign-in.$.tsx)
- [src/routes/sign-up.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/sign-up.tsx)
- [src/routes/sign-up.$.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/sign-up.$.tsx)

What changed:

- customer-only routes are protected earlier, before render
- signed-out users are redirected to sign-in with a validated redirect target
- admin/staff users are redirected away from customer pages earlier
- sign-in and sign-up routes validate `redirect` search params
- `/post-login` now acts as a cleaner role-resolution handoff page

Why this matters:

- prevents flashes of the wrong UI before redirect
- centralizes access control in the router instead of `useEffect`
- makes redirects easier to reason about

## 4. Typed Search Refactor for Route State

### Auth routes

Auth-related routes now use validated search instead of manually parsing strings.

### Hotel discovery route

Files:

- [src/routes/select-location.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/select-location.tsx)
- [src/routes/select-location/components/-helpers.ts](C:/Users/hp/hotel-management/hotel_management/src/routes/select-location/components/-helpers.ts)

What changed:

- `validateSearch` now owns:
  - `category`
  - `city`
  - `q`
  - `rate`
  - `sort`
- helper functions normalize incoming values
- navigation updates now produce full canonical search objects

Why this matters:

- filters and sorting survive refresh/share more reliably
- route state is now part of the router contract instead of scattered local parsing
- fewer invalid search combinations make it into the page

## 5. Hotel Detail Page Refactor

The original hotel detail route was carrying too much responsibility in one file. It was split into smaller pieces.

Main container:

- [src/routes/hotels.$hotelId.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/hotels.$hotelId.tsx)

Extracted pieces:

- [src/routes/hotels.$hotelId/components/-HotelPageChrome.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/hotels.$hotelId/components/-HotelPageChrome.tsx)
- [src/routes/hotels.$hotelId/components/-HotelAnnouncementsPreview.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/hotels.$hotelId/components/-HotelAnnouncementsPreview.tsx)
- [src/routes/hotels.$hotelId/components/-HotelDateSelection.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/hotels.$hotelId/components/-HotelDateSelection.tsx)
- [src/routes/hotels.$hotelId/components/-HotelRoomsGrid.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/hotels.$hotelId/components/-HotelRoomsGrid.tsx)
- [src/routes/hotels.$hotelId/components/-useHotelBookingState.ts](C:/Users/hp/hotel-management/hotel_management/src/routes/hotels.$hotelId/components/-useHotelBookingState.ts)

What changed:

- route file now focuses on params, queries, and orchestration
- booking modal state and resume-booking behavior moved into a dedicated hook
- hotel header/chrome moved out of the route
- announcements preview moved out of the route
- date selection moved out of the route
- rooms grid moved out of the route

Why this matters:

- smaller components are easier to read and change
- lower risk of unrelated rerenders
- much easier to test manually during future fixes

## 6. Shared Navigation Search Fixes

Several links across the app now pass the required typed `search` values explicitly.

Files touched include:

- [src/components/Header.tsx](C:/Users/hp/hotel-management/hotel_management/src/components/Header.tsx)
- [src/routes/index.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/index.tsx)
- [src/routes/_authenticated/announcements.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/_authenticated/announcements.tsx)
- [src/routes/_authenticated/bookings.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/_authenticated/bookings.tsx)
- [src/routes/_authenticated/bookings/components/-BookingsHeader.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/_authenticated/bookings/components/-BookingsHeader.tsx)
- [src/routes/select-location/components/-HotelGrid.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/select-location/components/-HotelGrid.tsx)
- [src/routes/select-location/components/-SelectLocationHeader.tsx](C:/Users/hp/hotel-management/hotel_management/src/routes/select-location/components/-SelectLocationHeader.tsx)

What changed:

- links to `/sign-in` and `/sign-up` now pass default auth search
- links to `/select-location` now pass default discovery search
- links to `/admin` now use canonical dashboard search when needed
- links to `/hotels/$hotelId` use canonical hotel-detail search when needed

Why this matters:

- this was required to make TanStack’s typed navigation compile cleanly
- it also makes route behavior more explicit and predictable

## 7. Convex Performance Improvements

Files:

- [convex/bookings.ts](C:/Users/hp/hotel-management/hotel_management/convex/bookings.ts)
- [convex/hotelStaff.ts](C:/Users/hp/hotel-management/hotel_management/convex/hotelStaff.ts)

What changed:

- replaced several sequential enrichment loops with batched fetch/map patterns
- added `uniqueIds` helpers to deduplicate lookups
- reduced repeated document fetches in enriched booking/staff list queries

Examples:

- booking lists now batch-load guest profiles and related users
- booking enrichment uses grouped lookups for rooms and hotels
- hotel staff lists now batch-load assignments and user records instead of walking nested loops one-by-one

Why this matters:

- fewer repeated database reads
- better scaling as the number of bookings, users, and assignments grows

## 8. Route Scanner Warning Fix

Problem:

- TanStack Router was warning that helper files under `src/routes/hotels.$hotelId/components` did not export `Route`

Fix:

- renamed those helper files to use the repo’s `-` prefix convention

Why this matters:

- the router now treats them as helper files instead of possible route files
- startup warnings from that hotel-detail refactor are removed

## 9. ESLint Ergonomics

File:

- [eslint.config.js](C:/Users/hp/hotel-management/hotel_management/eslint.config.js)

What changed:

- expanded ignores for generated/build output
- specifically ignored `convex/_generated/**`

What this fixed:

- lint is no longer polluted by generated-file parsing/noise

Important note:

- repo-wide lint still has many real source issues outside the narrow refactor area
- this session improved lint ergonomics and cleaned the route/type work, but it did not fully eliminate the existing global lint backlog

## 10. Verification Results

### Passed

- `npx tsc --noEmit`
- `npm run build`

### Development warning fix

The route-file warnings were fixed by renaming helper files with the `-` prefix.

### Dev server note

One later `npm run dev` check hit `EADDRINUSE` because another dev server instance was already running locally. That was a port/process collision, not a route error.

## 11. What This Means Architecturally

Before this refactor:

- auth and role redirects were spread across components
- route search state was partially implicit and partially manual
- hotel detail logic was too concentrated in one route file
- some Convex list queries were doing avoidable repeated lookups

After this refactor:

- auth checks are more router-driven
- search params are more strongly typed and canonical
- hotel detail is split into clearer container/presentation pieces
- booking/staff enrichment does less repeated work
- TanStack route helper files are named in a way the router understands

## 12. Remaining Work Outside This Session

The biggest unfinished area is repo-wide lint cleanup. The app now builds and type-checks, but there are still many existing lint errors in areas like:

- admin analytics files
- some older Convex modules
- some scripts and config files
- several unrelated admin screens

If you want, the next cleanup pass can focus specifically on:

1. making `npm run lint` pass cleanly
2. reducing large bundle chunks reported by build
3. refactoring the admin dashboard and admin bookings pages more aggressively into smaller presentational pieces

