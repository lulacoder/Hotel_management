# Auth Flow Refactor Plan

## Goal
Keep the landing page unchanged while making customer browsing public (hotel selector + hotel details). Require authentication only when a customer tries to book. Keep admin access unchanged and always authenticated.

## Scope
- Public customer browse routes: `/select-location` and `/hotels/$hotelId`
- Auth-gated customer action: booking (hold/confirm/cancel)
- Admin routes remain protected (`/admin/*`)

## Steps
1. Route structure
   - Move `src/routes/_authenticated/select-location.tsx` to `src/routes/select-location.tsx`.
   - Move `src/routes/_authenticated/hotels.$hotelId.tsx` to `src/routes/hotels.$hotelId.tsx`.
   - Keep `src/routes/_authenticated/bookings.tsx` under the authenticated layout.

2. UI gating for booking
   - In `src/routes/hotels.$hotelId.tsx`, require `isSignedIn` before opening the booking modal.
   - If not signed in, redirect to `/sign-in` (optionally include a redirect param to return after login).
   - Keep the backend enforcement (`requireCustomer`) as the final gate.

3. Public header/nav behavior
   - Only show user identity and `UserButton` if signed in.
   - Ensure “My Bookings” link is visible only when signed in.

4. Admin flow unchanged
   - Leave `src/routes/admin.tsx` auth checks and role enforcement as-is.
   - Keep backend `requireAdmin` checks intact.

## Validation
- Visiting `/select-location` and `/hotels/$hotelId` without login works.
- Clicking “Book Now” while signed out prompts login.
- Booking succeeds only after a valid customer login.
- Admin routes still require login and admin role.
