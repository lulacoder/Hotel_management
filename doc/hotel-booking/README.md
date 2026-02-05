# Hotel Booking System Documentation

Welcome to the hotel booking system docs! This documentation will help you understand and work with the codebase.

## Quick Links

| Document                            | What You'll Learn                                                 |
| ----------------------------------- | ----------------------------------------------------------------- |
| [Overview](./overview.md)           | Big picture - what the system does, tech stack, project structure |
| [Database Schema](./schema.md)      | All tables, fields, indexes, and data patterns                    |
| [Customer Flow](./customer-flow.md) | How customers browse, book, and manage reservations               |
| [Admin Flow](./admin-flow.md)       | How admins manage hotels, rooms, and bookings                     |
| [API Reference](./api-reference.md) | Every Convex function with examples                               |

## Related Documentation

- [Authentication Flow](../auth/auth.md) - Clerk + Convex auth, sign-in/up, role-based routing

## I Want To...

### Understand the codebase

1. Start with the [Overview](./overview.md) for the big picture
2. Read the [Schema](./schema.md) to understand data structures
3. Trace through [Customer Flow](./customer-flow.md) or [Admin Flow](./admin-flow.md)

### Add a new feature

1. Check the [Schema](./schema.md) - do you need new tables/fields?
2. Look at [API Reference](./api-reference.md) - can you use existing functions?
3. Follow existing patterns in the codebase

### Debug an issue

1. Check the Convex Dashboard for errors in function logs
2. Look at `auditEvents` table for action history
3. Verify auth/roles with [Auth Flow](../auth/auth.md)

### Understand the booking flow

See [Customer Flow](./customer-flow.md) - it walks through:

- Hold → Confirm → Cancel lifecycle
- Availability checking
- Automatic hold expiration

## Key Concepts Cheat Sheet

| Concept          | Quick Explanation                                                |
| ---------------- | ---------------------------------------------------------------- |
| Hold             | 15-minute reservation that must be confirmed                     |
| Soft Delete      | `isDeleted: true` instead of actual deletion                     |
| Prices in Cents  | $150.00 is stored as `15000`                                     |
| Dates as Strings | "YYYY-MM-DD" format, timezone-agnostic                           |
| Denormalization  | `hotelId` stored in bookings for faster queries                  |
| OCC              | Convex's Optimistic Concurrency Control prevents double-bookings |

## File Locations Cheat Sheet

| What            | Where                        |
| --------------- | ---------------------------- |
| Database schema | `convex/schema.ts`           |
| Auth helpers    | `convex/lib/auth.ts`         |
| Date utilities  | `convex/lib/dates.ts`        |
| Hotels API      | `convex/hotels.ts`           |
| Rooms API       | `convex/rooms.ts`            |
| Bookings API    | `convex/bookings.ts`         |
| Audit logging   | `convex/audit.ts`            |
| Cron jobs       | `convex/crons.ts`            |
| Admin layout    | `src/routes/admin.tsx`       |
| Customer routes | `src/routes/_authenticated/` |

## Getting Help

- **Convex docs:** https://docs.convex.dev
- **TanStack Router docs:** https://tanstack.com/router
- **Clerk docs:** https://clerk.com/docs
