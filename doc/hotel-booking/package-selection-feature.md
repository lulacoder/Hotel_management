# Package Selection Feature

## Overview

Before a customer fills in their guest details during the booking flow, they must choose one of three stay packages. The package determines what services are included and adds a fixed per-night surcharge on top of the room's base price. The selected package is stored on the booking record and is visible to both the customer and hotel staff.

---

## User Stories

### US-1 — Package Step in Booking Modal

**As a customer,**  
I want to see three clearly described stay packages before I enter my guest details,  
so that I can make an informed choice about what is included in my stay.

**Acceptance criteria:**

- When I click "Book Now" on a room, the booking modal opens on a **Package Selection** step (before guest details).
- Three options are presented: **Room Only**, **With Breakfast**, and **Full Package**.
- Each option displays:
  - The package name
  - A per-night add-on price badge (or "Included" for Room Only)
  - A one-line description
  - A bulleted list of what is included
- One package is pre-selected by default (Room Only).
- I can click any card to select it; the selected card is visually highlighted.
- A "Continue" button is enabled as soon as a package is selected and advances me to the guest details step.

---

### US-2 — Package Pricing Reflected in Total

**As a customer,**  
I want to see the updated total price that reflects my chosen package add-on,  
so that I know exactly what I will be paying before I confirm.

**Acceptance criteria:**

- In the **guest details** step and the **confirm** step, the price breakdown shows:
  - Room rate per night × number of nights
  - Package add-on per night × number of nights (hidden if Room Only / add-on is $0)
  - Total price
- If I go back and change my package, all price displays update immediately.
- The total displayed in the UI matches the `totalPrice` stored in the database.

---

### US-3 — Package Type Stored on Booking

**As a hotel staff member / admin,**  
I want to see which package a guest selected when I view their booking,  
so that I can prepare the correct services before and during their stay.

**Acceptance criteria:**

- The `packageType` field is stored on every booking record created after this feature ships.
- The `packageAddOn` (cents per night) is also stored as a snapshot, so historical bookings reflect the price at time of booking even if future add-on rates change.
- The admin booking detail page displays the package name and per-night add-on.
- Existing bookings created before this feature have `packageType` as `undefined`/absent and display gracefully (e.g., "Not specified").

---

### US-4 — Package Badge on Customer Booking Card

**As a customer,**  
I want to see which package I chose on my "My Bookings" page,  
so that I can confirm the services that are included in my upcoming stay.

**Acceptance criteria:**

- Each booking card on `/bookings` shows a small badge indicating the package (e.g., "Full Package", "With Breakfast", "Room Only").
- Bookings without a `packageType` (pre-feature) show no badge or display "—".

---

## Package Definitions

These are hardcoded in the frontend (`src/lib/packages.ts`). They are the single source of truth for labels, descriptions, inclusions, and pricing.

| Package          | Label          | Add-on per night | Description                                               |
| ---------------- | -------------- | ---------------- | --------------------------------------------------------- |
| `room_only`      | Room Only      | +$0              | Just the essentials for a comfortable stay.               |
| `with_breakfast` | With Breakfast | +$15             | Start every morning right with a full breakfast included. |
| `full_package`   | Full Package   | +$40             | Everything you need for a complete hotel experience.      |

### Inclusions per Package

**Room Only**

- Room accommodation
- WiFi
- TV
- Daily housekeeping

**With Breakfast**

- Room accommodation
- WiFi
- TV
- Daily housekeeping
- Daily breakfast buffet

**Full Package**

- Room accommodation
- WiFi
- TV
- Daily housekeeping
- Daily breakfast buffet
- Swimming pool access
- Spa access
- Gym access

---

## Flow Diagram

```
Customer clicks "Book Now" on a room
           │
           ▼
  ┌─────────────────────┐
  │  Step 1: Package    │  ← NEW STEP
  │  Selection          │
  │                     │
  │  [ Room Only   ]    │
  │  [ Breakfast   ]    │
  │  [ Full Pkg ✓  ]    │
  │                     │
  │  [ Continue →  ]    │
  └────────┬────────────┘
           │
           ▼
  ┌─────────────────────┐
  │  Step 2: Guest      │  ← existing 'details' step
  │  Details            │
  │                     │
  │  Name, Email,       │
  │  Special Requests   │
  │                     │
  │  Price breakdown:   │
  │  Room: $120 × 3     │
  │  Pkg add-on: $40×3  │
  │  Total: $480        │
  │                     │
  │  [ Hold Room →  ]   │
  └────────┬────────────┘
           │
           ▼  (holdRoom mutation called — packageType + packageAddOn sent)
  ┌─────────────────────┐
  │  Step 3: Confirm    │  ← existing 'confirm' step
  │                     │
  │  Room held for      │
  │  15 minutes         │
  │                     │
  │  Price shown again  │
  │                     │
  │  [ Confirm Booking ]│
  └─────────────────────┘
           │
           ▼
     Booking confirmed
     Navigate to /bookings
```

---

## Database Changes

### `bookings` table — new fields

| Field          | Type                                                | Required                           | Notes                                                |
| -------------- | --------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| `packageType`  | `'room_only' \| 'with_breakfast' \| 'full_package'` | No (optional for backwards compat) | Set on every new booking                             |
| `packageAddOn` | `number` (cents)                                    | No (optional for backwards compat) | Snapshot of add-on at booking time: 0, 1500, or 4000 |

### `totalPrice` calculation change

```
totalPrice = (room.basePrice + packageAddOn) × nights
```

Previously: `totalPrice = room.basePrice × nights`

---

## Files to Change

| File                                                             | Type of Change                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `convex/schema.ts`                                               | Add `packageType` and `packageAddOn` optional fields to `bookings` table                            |
| `convex/bookings.ts`                                             | Add `packageType` and `packageAddOn` to `holdRoom` args and insert; update `totalPrice` calculation |
| `src/lib/packages.ts`                                            | **New file** — export `PACKAGES` array with all package definitions                                 |
| `src/routes/hotels.$hotelId/components/-BookingModal.tsx`        | Add `'package'` as first step; add package selection UI; update price display                       |
| `src/routes/_authenticated/bookings/components/-BookingCard.tsx` | Show `packageType` badge                                                                            |
| `src/routes/admin/bookings/$bookingId.tsx`                       | Show `packageType` and `packageAddOn` in booking detail                                             |

---

## Success Scenarios

### SC-1 — Customer selects Full Package and confirms

1. Customer is on `/hotels/abc123`, has selected dates, and clicks "Book Now" on a Standard Room at $120/night for 3 nights.
2. Modal opens on the **Package Selection** step. "Room Only" is pre-selected.
3. Customer clicks "Full Package". The card highlights. Add-on badge shows "+$40/night".
4. Customer clicks "Continue". Modal advances to guest details.
5. Price breakdown shows: Room $120 × 3 = $360, Package add-on $40 × 3 = $120, **Total: $480**.
6. Customer fills in name and email, clicks "Hold Room".
7. `holdRoom` mutation is called with `packageType: 'full_package'`, `packageAddOn: 4000`, and `totalPrice: 48000` (cents).
8. Booking is created with `status: 'held'`. Modal advances to confirm step. Total $480 is shown again.
9. Customer clicks "Confirm Booking". `confirmBooking` mutation succeeds.
10. Customer is navigated to `/bookings`. The booking card shows a "Full Package" badge and $480 total.
11. Admin views the booking detail; "Full Package — +$40/night" is displayed.

---

### SC-2 — Customer changes package before holding

1. Customer opens the modal. "Room Only" is pre-selected.
2. Customer selects "With Breakfast". Price preview updates to show the $15/night add-on.
3. Customer changes their mind and selects "Room Only". Price preview reverts to room base price only, with no add-on line.
4. Customer continues and holds the room. Booking is stored with `packageType: 'room_only'`, `packageAddOn: 0`.

---

### SC-3 — Customer goes back from details to package step

1. Customer has reached the guest details step with "Full Package" selected.
2. Customer clicks a "Back" button to return to the package step.
3. "Full Package" is still highlighted (selection is preserved in component state).
4. Customer changes to "With Breakfast" and continues.
5. Price breakdown in the details step reflects the new $15/night add-on.

---

### SC-4 — Admin views booking without a package (pre-feature booking)

1. Admin navigates to `/admin/bookings/oldBookingId` for a booking created before this feature.
2. The booking record has no `packageType` field.
3. The admin detail page displays "Package: Not specified" gracefully without crashing.

---

## Failure Scenarios

### FS-1 — Hold room mutation fails (room taken by another user)

1. Customer has selected "Full Package" and filled in guest details.
2. Between the customer opening the modal and clicking "Hold Room", another user books the same room for the same dates.
3. The `holdRoom` mutation throws a `CONFLICT` error.
4. The modal displays: "This room is no longer available for the selected dates. Please go back and choose a different room."
5. The package selection step state is preserved so the customer does not lose their choice if they try another room.
6. No booking record is created.

---

### FS-2 — Hold room mutation fails (dates invalid)

1. Customer manipulates the date input and sends a check-in date in the past.
2. `holdRoom` throws an `INVALID_INPUT` error.
3. The modal displays the error message returned by the server.
4. No booking record is created.
5. The customer remains on the guest details step and can correct the dates.

---

### FS-3 — Confirm booking fails (hold expired)

1. Customer held a room and was shown the confirm step.
2. Customer waited more than 15 minutes without confirming.
3. The cron job has already set the booking status to `expired`.
4. Customer clicks "Confirm Booking".
5. `confirmBooking` throws an `INVALID_STATE` error ("Hold has expired").
6. The modal displays: "Your hold has expired. Please start a new booking."
7. The modal closes (or a "Start Over" button closes it and resets state).

---

### FS-4 — Network error during package step

1. Customer is on the package selection step with no network connectivity.
2. The package step is entirely client-side (no API calls at this point), so the UI renders normally.
3. The error only surfaces when "Hold Room" is clicked in step 2 — handled by FS-1/FS-2 generic error handling.

---

### FS-5 — Invalid packageType sent to backend

1. A malformed request (e.g., via a modified client) sends `packageType: 'vip_suite'` which is not a valid literal.
2. Convex's argument validator rejects the request before it reaches the handler.
3. The mutation returns a validation error.
4. No booking record is created.

---

## Out of Scope (Not in This Feature)

- Per-hotel or per-room customization of package inclusions (all packages are global and hardcoded).
- Dynamic pricing for packages (add-on rates are constants, not configurable from admin UI).
- Payment gateway integration (payment remains a stub; `paymentStatus: 'pending'` is set on confirm as before).
- A dedicated `/booking/confirm` route (the flow remains modal-based inside the hotel detail page).
- Changing a package after a booking has been held or confirmed (would require a cancel + rebook).

---

## Open Questions / Future Considerations

| #   | Question                                                                                                      | Status                  |
| --- | ------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Should hotel staff be able to override the package on a booking (e.g., upgrade a guest)?                      | Not in scope — deferred |
| 2   | Should package add-on rates be configurable per hotel from the admin UI?                                      | Not in scope — deferred |
| 3   | Should the package inclusions be localizable (multi-language)?                                                | Not in scope — deferred |
| 4   | Should "Full Package" availability depend on whether the hotel actually has a spa/pool (based on hotel tags)? | Not in scope — deferred |
