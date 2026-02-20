# Walk-in Booking Feature

A hotel cashier can book a room for a walk-in guest directly from the admin portal, without the guest needing a Clerk account.

---

## User Stories

### Cashier
- **US-1** — As a cashier, I want to search for a walk-in guest by phone or email so that I can reuse their profile if they've visited before.
- **US-2** — As a cashier, I want to create a new guest profile (name + phone/email) on the spot when no matching profile is found.
- **US-3** — As a cashier, I want to browse available rooms for my hotel and select dates so that I can find the right room for the guest.
- **US-4** — As a cashier, I want to open a booking modal, choose a package, review the total, and confirm the booking in one flow so that the guest is checked in immediately.
- **US-5** — As a cashier, I want the booking to start as `confirmed` (not `held`) so that there is no 15-minute hold expiry for in-person transactions.
- **US-6** — As a cashier, I want to mark the walk-in booking as cash-paid using the existing "Accept Cash" button in the Bookings page.

### Hotel Admin
- **US-7** — As a hotel admin, I want to see walk-in bookings alongside online bookings in the Bookings page, with the guest's name, phone, and email shown from their guest profile.
- **US-8** — As a hotel admin, I can access the walk-in flow from admin navigation and create walk-in bookings when needed.

### Room Admin (Super-admin)
- **US-9** — As a room admin, I can see all bookings across all hotels, with walk-in guest profile data properly displayed.

---

## Proposed Changes

### Database — `convex/schema.ts`

#### New table: `guestProfiles`

```ts
guestProfiles: defineTable({
  name:         v.string(),
  phone:        v.optional(v.string()),  // at least one of phone/email required (enforced in mutation)
  email:        v.optional(v.string()),
  createdBy:    v.id('users'),           // cashier who created the profile
  createdAt:    v.number(),
  linkedUserId: v.optional(v.id('users')), // set if guest later creates an online account
})
  .index('by_phone', ['phone'])
  .index('by_email', ['email'])
  .index('by_linked_user', ['linkedUserId'])
```

#### Modify table: `bookings`

| Field | Before | After |
|---|---|---|
| `userId` | `v.id('users')` (required) | `v.optional(v.id('users'))` |
| `guestProfileId` | _(absent)_ | `v.optional(v.id('guestProfiles'))` |

Add index: `.index('by_guest_profile', ['guestProfileId'])`

> [!IMPORTANT]
> Either `userId` or `guestProfileId` must be present — enforced in every booking mutation.

---

### New Convex File — `convex/guestProfiles.ts`

| Function | Type | Auth | Description |
|---|---|---|---|
| `findOrCreate` | `mutation` | cashier / hotel_admin | Looks up guest by phone or email. Creates a new profile if not found. Returns `guestProfileId`. |
| `search` | `query` | cashier / hotel_admin | Search guest profiles by phone or email string. |
| `get` | `query` | hotel staff | Fetch a single guest profile by ID. |

---

### Modified Convex File — `convex/bookings.ts`

#### New mutation: `walkInBooking`
- **Auth:** `hotel_cashier` or `hotel_admin` only
- **Args:** `guestProfileId`, `roomId`, `checkIn`, `checkOut`, `packageType`
- **Behaviour:** Creates booking with `status: 'confirmed'`, `paymentStatus: 'pending'`, no hold step. Logs to `auditEvents`.

#### Updated queries: `getEnriched`, `getByHotel`
When a booking has `guestProfileId`, join `guestProfiles` and return:
```ts
guestProfile: v.optional(v.object({
  _id: v.id('guestProfiles'),
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
}))
```

---

### Modified File — `src/routes/admin.tsx`

#### Nav item added
```ts
{ to: '/admin/walk-in', label: 'Walk-in Booking', icon: UserPlus }
```

#### Visibility filter — cashier and hotel admin
```ts
if (item.to === '/admin/walk-in') {
  return (
    hotelAssignment?.role === 'hotel_cashier' ||
    hotelAssignment?.role === 'hotel_admin'
  )
}
```

**Resulting nav per role:**

| Role | Visible Nav Items |
|---|---|
| `hotel_cashier` | Rooms · Bookings · **Walk-in Booking** |
| `hotel_admin` | Dashboard · Hotels · Rooms · Bookings · **Walk-in Booking** |
| `room_admin` | Dashboard · Hotels · Rooms · Bookings · Users |

---

### New File — `src/routes/admin/walk-in/index.tsx`

Three-step flow on a single page:

```
Step 1 — Guest Lookup
  ├── Input: phone or email
  ├── "Search" → finds existing guest profile (shows name + past bookings count)
  └── If not found → inline form: Name + Phone + Email (at least one contact required)

Step 2 — Select Room & Dates
  ├── Hotel auto-selected (cashier's assigned hotel)
  ├── Check-in / Check-out date pickers
  └── Room cards grid (available rooms for selected dates)

Step 3 — Booking Modal (opens on "Book" click)
  ├── Package selection (room_only / with_breakfast / full_package)
  ├── Summary: guest info · room · dates · total price
  ├── "Book & Confirm" → calls walkInBooking mutation
  └── Success → redirect to /admin/bookings

> Implementation note: this is currently rendered inline as Step 3 on the page (not a separate modal dialog).
```

---

### Modified File — `src/routes/admin/bookings/index.tsx`

Walk-in booking cards display guest profile data when present:
- **Guest column:** `guestProfile.name` with a walk-in badge
- **Detail modal:** phone + email from `guestProfile`

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Walk-in booking initial status | `confirmed` | Cashier is present; no hold/expiry needed |
| Payment on walk-in | `pending` → cashier uses existing "Accept Cash" | Reuses existing flow |
| Guest lookup priority | phone first, then email | Both searchable |
| `userId` nullability | made optional | Unaffected for all existing online bookings |
| Walk-in nav visibility | cashier + hotel_admin | Allows both hotel operations roles to handle front-desk bookings |
| Future account linking | `linkedUserId` on `guestProfiles` | Guest can claim history after signing up |

---

## Verification Plan

### Automated / Dev
- `walkInBooking` creates booking with `guestProfileId`, `status: confirmed`, no `holdExpiresAt`
- `findOrCreate` is idempotent (same phone → same profile)
- `getByHotel` and `getEnriched` return `guestProfile` for walk-in bookings
- Online bookings with `userId` are unaffected

### Manual UI
- [ ] Cashier sees "Walk-in Booking" in sidebar
- [ ] Hotel admin sees "Walk-in Booking" in sidebar
- [ ] Full walk-in flow: guest lookup → room select → inline step 3 confirm
- [ ] Confirmed walk-in appears in `/admin/bookings` with guest profile info
- [ ] Hotel admin can view walk-in detail (phone/email shown)
- [ ] "Accept Cash" works on walk-in bookings
- [ ] Status transitions work: confirmed → checked_in → checked_out
