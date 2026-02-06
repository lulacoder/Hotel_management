# Hotel Booking System - Overview

Welcome! This document gives you a friendly tour of the hotel booking system. Whether you're a new developer joining the project or just need a refresher, this guide will help you understand how everything fits together.

## What Does This System Do?

At its core, this is a hotel room booking platform with two main user types:

1. **Customers** - Browse hotels, select rooms, and make bookings
2. **Admins** (`room_admin` role) - Manage hotels, rooms, and view all bookings

## Tech Stack Quick Reference

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Frontend | React + TanStack Router (Start)                   |
| Backend  | Convex (serverless functions + database)          |
| Auth     | Clerk (sessions) + Convex (user profiles & roles) |
| Styling  | Tailwind CSS (dark theme with amber accents)      |

## Project Structure at a Glance

```
hotel_management/
├── convex/                    # Backend (Convex functions + schema)
│   ├── schema.ts              # Database tables & indexes
│   ├── lib/
│   │   ├── auth.ts            # Auth helpers (requireUser, requireAdmin, etc.)
│   │   └── dates.ts           # Date validation & overlap checking
│   ├── hotels.ts              # Hotel CRUD operations
│   ├── rooms.ts               # Room CRUD + availability
│   ├── bookings.ts            # Booking flow (hold → confirm → cancel)
│   ├── bookingsInternal.ts    # Internal cleanup for expired holds
│   ├── seed.ts                # Data import mutations
│   ├── audit.ts               # Audit logging
│   └── crons.ts               # Scheduled jobs (hold expiration)
│
├── scripts/                   # Utility scripts
│   └── seed-hotels.ts         # Import hotels from JSON
│
├── src/
│   ├── lib/
│   │   └── distance.ts        # Haversine distance calculation
│   ├── hooks/
│   │   └── useGeolocation.ts  # Browser geolocation hook
│   └── routes/                # Frontend routes
│       ├── index.tsx              # Landing page
│       ├── post-login.tsx         # Role-based routing after login
│       ├── admin.tsx              # Admin layout (sidebar + outlet)
│       ├── admin/
│       │   ├── index.tsx          # Admin dashboard
│       │   ├── hotels/
│       │   │   ├── index.tsx      # Hotels list + create/edit
│       │   │   └── $hotelId.tsx   # Hotel detail + room management
│       │   ├── rooms/
│       │   │   └── index.tsx      # Rooms overview (redirects to hotel)
│       │   └── bookings/
│       │       └── index.tsx      # All bookings (by hotel)
│       └── _authenticated/
│           ├── select-location.tsx  # Customer: browse hotels (with geolocation)
│           ├── hotels.$hotelId.tsx  # Customer: view hotel + book rooms
│           └── bookings.tsx         # Customer: my bookings
│
├── Hotel_data/                # Source data for import
│   └── Hotel.json             # 50 hotels, 757 rooms
│
└── doc/                       # Documentation (you are here!)
    ├── auth/                  # Authentication docs
    └── hotel-booking/         # Hotel booking docs
```

## Key Concepts

### User Roles

- **`customer`** - Default role for new users. Can browse and book rooms.
- **`room_admin`** - Can manage hotels, rooms, and view all bookings.

Roles are stored in the `users` table in Convex and checked on both frontend (for UI) and backend (for security).

### Booking Lifecycle

Bookings go through these states:

```
[Customer selects dates & room]
         ↓
      HELD (15 min timer starts)
         ↓
   [Customer confirms]
         ↓
     CONFIRMED
         ↓
   [Check-in day]
         ↓
    CHECKED_IN
         ↓
   [Check-out day]
         ↓
    CHECKED_OUT
```

Bookings can also be:

- **CANCELLED** - Customer or admin cancelled
- **EXPIRED** - Hold timer ran out (automatic cleanup every 5 min)

### Soft Delete Pattern

Hotels and rooms are never truly deleted. Instead, they have an `isDeleted` flag. This preserves booking history and allows restoration if needed.

### Audit Logging

Every significant action is logged to the `auditEvents` table:

- Who did it (`actorId`)
- What they did (`action`)
- What changed (`previousValue` → `newValue`)

This creates an audit trail for compliance and debugging.

## Related Documentation

- [Authentication Flow](../auth/auth.md) - How users sign in and get routed
- [Database Schema](./schema.md) - Detailed table structures
- [Customer Flow](./customer-flow.md) - Booking journey walkthrough
- [Admin Flow](./admin-flow.md) - Hotel & room management
- [API Reference](./api-reference.md) - All Convex functions
- [Data Import & Geolocation](./data-import-geolocation.md) - Seed scripts and distance features

## Quick Start for Developers

1. **Run the dev server:**

   ```bash
   npm run dev
   ```

2. **Seed the database with sample data:**

   ```bash
   # Generate Convex types first
   npx convex dev --once

   # Import 50 hotels with 757 rooms
   npx tsx scripts/seed-hotels.ts --clear
   ```

3. **Create a test admin:**
   - Sign up with a new account
   - In Convex dashboard, change the user's `role` to `room_admin`

4. **Explore the app:**
   - Log in as customer → Browse hotels with geolocation → Book a room
   - Log in as admin → Manage hotels and rooms

5. **Explore the code:**
   - Start with `convex/schema.ts` to understand the data model
   - Look at `convex/bookings.ts` for the core booking logic
   - Check `src/routes/_authenticated/select-location.tsx` for geolocation features
   - See `src/lib/distance.ts` for the Haversine formula

Happy coding!
