# Manual Bank Transfer Payment — Feature Plan

## Overview

This document describes the full scope, design decisions, and implementation plan for the manual bank transfer payment feature. The flow allows hotel cashiers to publish their bank account number, and customers to submit proof of payment (national ID photo + transaction ID) before a cashier verifies and confirms the booking.

---

## User Stories

### Cashier / Hotel Admin

**US-1: Set Bank Account Number**

> As a `hotel_cashier` or `hotel_admin`, I want to enter my hotel's bank account number once from the hotel detail page, so that customers can see where to send their payment.

- Acceptance criteria:
  - A "Payment Settings" section appears on `/admin/hotels/$hotelId` for users with `hotel_cashier` or `hotel_admin` role for that hotel (and for `room_admin`)
  - The section shows the current account number if one is already set
  - The cashier can enter or update the account number and save it
  - One bank account record exists per hotel (upsert behavior)
  - Saving is recorded in the audit log

**US-2: Verify Payment Proof**

> As a `hotel_cashier` or `hotel_admin`, I want to see the national ID photo and transaction ID submitted by the customer on the booking detail page, so that I can approve or reject the payment.

- Acceptance criteria:
  - When a booking has status `pending_payment`, the `/admin/bookings/$bookingId` page shows:
    - The customer's national ID image rendered from Convex storage
    - The transaction ID in a copyable text element
    - An "Approve Payment" button
    - A "Reject Payment" button
  - Approving transitions the booking: `pending_payment` → `confirmed`, `paymentStatus: 'pending'` → `'paid'`
  - Rejecting transitions the booking: `pending_payment` → `cancelled`, `paymentStatus: 'pending'` → `'failed'`
  - Both actions are recorded in the audit log

---

### Customer

**US-3: See Bank Account Number During Booking**

> As a customer, I want to see the hotel's bank account number during the booking confirmation step, so that I know where to send my payment.

- Acceptance criteria:
  - In `BookingModal` Step 3, the hotel's bank account number is displayed in a visually distinct, one-click copyable element
  - If no bank account has been set for the hotel, a fallback message is shown (e.g. "Payment details not yet configured — contact the hotel")

**US-4: Upload National ID and Enter Transaction ID**

> As a customer, I want to upload a photo of my national ID and enter my transaction ID on the confirm step, so that the hotel can verify my payment.

- Acceptance criteria:
  - `BookingModal` Step 3 shows:
    - Bank account number (copyable)
    - File upload field for national ID photo (image files only, required)
    - Text input for transaction ID (required)
    - A "Submit Payment Proof" button
  - Both fields are required — the submit button is disabled until both are filled
  - On submit, the national ID image is uploaded to Convex storage and the booking is transitioned from `held` → `pending_payment`
  - A success message is shown: _"Your payment proof has been submitted. Your booking is awaiting verification by the hotel."_

**US-5: Track Pending Booking**

> As a customer, I want to see that my booking is awaiting verification on my bookings page, so that I know its current state.

- Acceptance criteria:
  - The `BookingCard` on `/_authenticated/bookings` shows an amber "Awaiting Verification" badge when `status === 'pending_payment'`
  - Once approved by the cashier, the badge updates to the existing "Confirmed" state

---

## Design Decisions

| Decision                          | Choice                                 | Rationale                                                                                                       |
| --------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Bank account scope                | Per-hotel                              | Each hotel has its own bank account; customers pay the hotel they're booking                                    |
| Who can set bank account          | `hotel_cashier` and `hotel_admin`      | Both roles operate at hotel scope; limiting to admin only would block cashiers who manage day-to-day operations |
| Where cashier configures it       | Existing `/admin/hotels/$hotelId` page | Avoids new routes; cashiers already use this page to manage their hotel                                         |
| National ID upload                | Required                               | Cannot confirm booking without it — needed for fraud prevention                                                 |
| Transaction ID                    | Required at confirmation time          | Proves payment was initiated before the hold expires                                                            |
| Post-submission state             | `pending_payment` (new status)         | Cleaner than overloading `held` or using only `paymentStatus`; makes the booking lifecycle explicit             |
| Cashier verification UI           | Existing `/admin/bookings/$bookingId`  | Staff already navigate here for booking management                                                              |
| Rejection outcome                 | `cancelled` (terminal)                 | Room is freed immediately; customer must re-book with a fresh hold                                              |
| Hold window for `pending_payment` | Same 15-minute window as `held`        | Consistent with the existing hold expiry; cashiers should verify promptly                                       |
| Walk-in bookings                  | Unchanged                              | Walk-in flow uses `acceptCashPayment`; bank transfer is online-only                                             |

---

## Status Lifecycle (Updated)

```
held
  ├─→ pending_payment   (customer submits national ID + transaction ID)
  │     ├─→ confirmed   (cashier approves — paymentStatus: paid)
  │     └─→ cancelled   (cashier rejects — paymentStatus: failed)
  │           OR expires after 15 min → expired
  └─→ cancelled         (customer or admin cancels before submitting proof)
  └─→ expired           (hold timer runs out before proof submitted)

confirmed
  └─→ checked_in → checked_out
  └─→ cancelled
```

---

## Schema Changes

### 1. New table: `hotelBankAccounts`

```typescript
hotelBankAccounts: defineTable({
  hotelId: v.id('hotels'),
  accountNumber: v.string(),
  setBy: v.id('users'),
  updatedAt: v.number(),
}).index('by_hotel', ['hotelId'])
```

### 2. Modified table: `bookings`

Add two optional fields:

```typescript
transactionId: v.optional(v.string()),
nationalIdStorageId: v.optional(v.id('_storage')),
```

### 3. Modified `bookings.status` union

Add `'pending_payment'` between `'held'` and `'confirmed'`:

```typescript
status: v.union(
  v.literal('held'),
  v.literal('pending_payment'),   // new
  v.literal('confirmed'),
  v.literal('checked_in'),
  v.literal('checked_out'),
  v.literal('cancelled'),
  v.literal('expired'),
  v.literal('outsourced'),
),
```

---

## New Convex Functions

### `convex/hotelBankAccounts.ts` (new file)

| Function     | Type     | Auth                                                            | Description                                                                   |
| ------------ | -------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `set`        | mutation | `hotel_cashier` or `hotel_admin` for the hotel, or `room_admin` | Upserts the bank account number for a hotel. Creates audit log entry.         |
| `getByHotel` | query    | Public                                                          | Returns the `accountNumber` for a given `hotelId`. Returns `null` if not set. |

### `convex/bookings.ts` (modified)

| Function             | Type     | Auth                                                     | Description                                                                                                                                                                                                        |
| -------------------- | -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `submitPaymentProof` | mutation | Authenticated customer who owns the booking              | Accepts `bookingId`, `transactionId`, `nationalIdStorageId`. Validates booking is `held` and not expired. Transitions `held` → `pending_payment`. Stores `transactionId` and `nationalIdStorageId` on the booking. |
| `verifyPayment`      | mutation | `hotel_cashier` or `hotel_admin` for the booking's hotel | Transitions `pending_payment` → `confirmed`, sets `paymentStatus: 'paid'`. Creates audit log entry.                                                                                                                |
| `rejectPayment`      | mutation | `hotel_cashier` or `hotel_admin` for the booking's hotel | Transitions `pending_payment` → `cancelled`, sets `paymentStatus: 'failed'`. Creates audit log entry.                                                                                                              |

### `convex/bookingsInternal.ts` (modified)

- `cleanupExpiredHolds` — update to also expire `pending_payment` bookings where `holdExpiresAt < now`. These expire with `status: 'expired'` and `paymentStatus: 'failed'`.

---

## UI Changes

### A. `/admin/hotels/$hotelId.tsx` — Payment Settings Section

Add a new card below the existing hotel management content:

```
┌─────────────────────────────────────────────┐
│  Payment Settings                           │
│                                             │
│  Bank Account Number                        │
│  ┌─────────────────────────────────────┐    │
│  │ e.g. 1000234567890                  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [ Save Account Number ]                    │
└─────────────────────────────────────────────┘
```

- Only visible to users with `hotel_cashier`, `hotel_admin` (for this hotel), or `room_admin`
- Shows current value pre-filled if one exists
- Save triggers `hotelBankAccounts.set` mutation

---

### B. `src/routes/hotels.$hotelId/components/-BookingModal.tsx` — Step 3 Restructure

**Current Step 3:** Summary + "Confirm Booking" button (calls `confirmBooking`)

**New Step 3:** Payment proof submission

```
┌─────────────────────────────────────────────────────┐
│  Step 3: Complete Payment                           │
│                                                     │
│  Transfer the total amount to:                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  Account No.  1000234567890        [ Copy ]   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Amount Due:  $240.00 (3 nights × $80/night)        │
│                                                     │
│  Upload National ID *                               │
│  ┌───────────────────────────────────────────────┐  │
│  │  [ Choose File ]  national_id.jpg  ✓          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Transaction ID *                                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  TXN-20260225-XXXXXXX                         │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [ Submit Payment Proof ]                           │
└─────────────────────────────────────────────────────┘
```

**After successful submission:**

```
┌─────────────────────────────────────────────────────┐
│  Payment Proof Submitted                            │
│                                                     │
│  Your booking is awaiting verification.             │
│  The hotel will review your national ID and         │
│  transaction ID and confirm shortly.                │
│                                                     │
│  Booking ID: #ABC123                                │
│                                                     │
│  [ View My Bookings ]                               │
└─────────────────────────────────────────────────────┘
```

**Implementation notes:**

- File upload follows the existing Convex storage pattern in `src/lib/imageUpload.ts`
- Step 2 (`holdRoom`) runs first; Step 3 then calls `submitPaymentProof` with the held booking's `_id`
- The "Confirm Booking" button that previously called `confirmBooking` is removed from customer flow entirely
- If `hotelBankAccounts.getByHotel` returns `null`, show: _"Payment details not yet configured — please contact the hotel directly."_ and disable submission

---

### C. `/admin/bookings/$bookingId.tsx` — Payment Verification UI

When `booking.status === 'pending_payment'`, add a "Payment Verification" section:

```
┌─────────────────────────────────────────────────────┐
│  Payment Verification                               │
│                                                     │
│  Transaction ID                                     │
│  TXN-20260225-XXXXXXX                  [ Copy ]     │
│                                                     │
│  National ID                                        │
│  ┌───────────────────────────────────────────────┐  │
│  │  [ national ID image rendered here ]          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [ Approve Payment ]    [ Reject Payment ]          │
└─────────────────────────────────────────────────────┘
```

- "Approve Payment" calls `bookings.verifyPayment` → `confirmed` + `paymentStatus: 'paid'`
- "Reject Payment" calls `bookings.rejectPayment` → `cancelled` + `paymentStatus: 'failed'`
- Both buttons show a confirmation prompt before executing
- National ID image is loaded via `useQuery(api.storage.getUrl, { storageId: booking.nationalIdStorageId })`

---

### D. `/_authenticated/bookings/components/-BookingCard.tsx` — New Status Badge

Add handling for `pending_payment` status:

| Status            | Badge color | Label                 |
| ----------------- | ----------- | --------------------- |
| `pending_payment` | Amber       | Awaiting Verification |

---

## Files to Modify

| File                                                             | Type of Change                                                                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `convex/schema.ts`                                               | Add `hotelBankAccounts` table; add `transactionId` + `nationalIdStorageId` to `bookings`; add `'pending_payment'` to status union |
| `convex/hotelBankAccounts.ts`                                    | **New file** — `set` and `getByHotel` functions                                                                                   |
| `convex/bookings.ts`                                             | Add `submitPaymentProof`, `verifyPayment`, `rejectPayment` mutations                                                              |
| `convex/bookingsInternal.ts`                                     | Update `cleanupExpiredHolds` to expire `pending_payment` bookings                                                                 |
| `src/routes/admin/hotels/$hotelId.tsx`                           | Add Payment Settings section                                                                                                      |
| `src/routes/hotels.$hotelId/components/-BookingModal.tsx`        | Restructure Step 3 for payment proof submission                                                                                   |
| `src/routes/_authenticated/bookings/components/-BookingCard.tsx` | Add `pending_payment` badge                                                                                                       |
| `src/routes/admin/bookings/$bookingId.tsx`                       | Add Payment Verification UI                                                                                                       |

---

## Out of Scope

- No payment gateway integration (Stripe, etc.)
- No email notifications on approval/rejection (could be a future enhancement)
- No file size or dimension validation on the national ID upload beyond basic image type check
- Walk-in bookings are unaffected — cashier handles payment directly via `acceptCashPayment`
- No re-submission flow — if rejected, the customer must create a new booking
