# Authentication Refactoring Guide

## Current Security Vulnerability

### The Problem

Every Convex function that requires auth accepts `clerkUserId` as a plain argument with no verification:

```typescript
// convex/hotels.ts:216 - anyone can pass ANY clerkUserId
const admin = await requireAdmin(ctx, args.clerkUserId)
```

An attacker can:

1. Find any admin's `clerkUserId` (it appears in network tab, Convex dashboard, logs)
2. Call mutations directly from the browser console while logged in as a regular customer:

```javascript
// Logged in as customer, impersonating an admin:
convex.mutation(api.hotels.create, { clerkUserId: "user_admin123", name: "Fake Hotel", ... })
```

### What IS Secure

- **Clerk public metadata** - users cannot change their own metadata; only the Clerk backend can
- **Webhook user sync** - roles are correctly written to the Convex `users` table via the webhook

### What is NOT Secure

- **Convex URL is public** - anyone with DevTools open can see it and call functions directly
- **`clerkUserId` args are trusted blindly** - the backend has no way to verify the caller actually owns that ID

---

## The Fix: Wire Clerk JWTs into Convex

Convex has a built-in `ctx.auth.getUserIdentity()` API that reads a cryptographically signed JWT
from the request. Once wired up, the backend can verify WHO is calling without trusting any argument.

---

## Step 1: Create a JWT Template in Clerk Dashboard

Go to **Clerk Dashboard → JWT Templates → New template** and name it exactly `convex`.

Use this claims body:

```json
{
  "sub": "{{user.id}}",
  "email": "{{user.primary_email_address}}"
}
```

> Do not include `role` in the JWT. Role is fetched from the database (the source of truth),
> not from the token. This avoids stale role data if a user's role changes.

---

## Step 2: Update the Convex Provider

Your current `provider.tsx` uses `@convex-dev/react-query`'s `ConvexQueryClient`, which must be
preserved. The auth token is wired via `convexQueryClient.convexClient.setAuth()`.

```typescript
// src/integrations/convex/provider.tsx
import { ConvexProvider } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'

const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  console.error('missing envar VITE_CONVEX_URL')
}

const convexQueryClient = new ConvexQueryClient(CONVEX_URL)

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { getToken, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded) return

    convexQueryClient.convexClient.setAuth(async () => {
      const token = await getToken({ template: 'convex' })
      return token ?? null
    })
  }, [getToken, isLoaded])

  return (
    <ConvexProvider client={convexQueryClient.convexClient}>
      {children}
    </ConvexProvider>
  )
}
```

Key points:

- `convexQueryClient` stays module-level (same as before) so react-query integration is unaffected
- `setAuth` is called on `convexQueryClient.convexClient`, not a new client
- The `useEffect` re-runs if `getToken` or `isLoaded` changes (e.g. after sign-in/out)

---

## Step 3: Rewrite `convex/lib/auth.ts`

Remove all `clerkUserId` parameters. Identity now comes from `ctx.auth.getUserIdentity()`.

Note the correct type import: `QueryCtx | MutationCtx` from `'../_generated/server'`.
`GenericCtx` does not exist in Convex's generated types - do not use it.

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx } from '../_generated/server'
import { ConvexError } from 'convex/values'
import { Doc, Id } from '../_generated/dataModel'

export type UserRole = 'customer' | 'room_admin'
export type HotelStaffRole = 'hotel_admin' | 'hotel_cashier'

// Get the verified Clerk user ID from the JWT - never from args
async function getVerifiedClerkId(
  ctx: QueryCtx | MutationCtx,
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return identity.subject // This is the Clerk user ID, cryptographically verified
}

// Require an authenticated session - throws if not signed in
async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<string> {
  const clerkUserId = await getVerifiedClerkId(ctx)
  if (!clerkUserId) {
    throw new ConvexError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated. Please sign in.',
    })
  }
  return clerkUserId
}

// Internal: look up user by verified clerk ID
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<Doc<'users'> | null> {
  return await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
    .unique()
}

// Require user exists in DB - identity comes from JWT, not args
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'>> {
  const clerkUserId = await requireAuth(ctx)
  const user = await getCurrentUser(ctx, clerkUserId)
  if (!user) {
    throw new ConvexError({
      code: 'UNAUTHORIZED',
      message: 'User account not found. Please sign in again.',
    })
  }
  return user
}

// Require room_admin role (global admin)
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  if (user.role !== 'room_admin') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message:
        'Admin access required. You do not have permission to perform this action.',
    })
  }
  return user
}

// Require customer role
export async function requireCustomer(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  if (user.role !== 'customer') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Customer access required. Admins cannot perform this action.',
    })
  }
  return user
}

// Get hotel staff assignment for a user
export async function getHotelAssignment(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<Doc<'hotelStaff'> | null> {
  return await ctx.db
    .query('hotelStaff')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
}

// Require access to a specific hotel.
// room_admin passes automatically. hotel staff must be assigned to that hotel.
export async function requireHotelAccess(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<'hotels'>,
): Promise<{ user: Doc<'users'>; assignment: Doc<'hotelStaff'> | null }> {
  const user = await requireUser(ctx)

  if (user.role === 'room_admin') {
    return { user, assignment: null }
  }

  const assignment = await getHotelAssignment(ctx, user._id)
  if (!assignment || assignment.hotelId !== hotelId) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this hotel.',
    })
  }

  return { user, assignment }
}

// Require hotel_admin or room_admin (for management operations)
export async function requireHotelManagement(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<'hotels'>,
): Promise<{ user: Doc<'users'>; assignment: Doc<'hotelStaff'> | null }> {
  const { user, assignment } = await requireHotelAccess(ctx, hotelId)

  if (user.role === 'room_admin') {
    return { user, assignment }
  }

  if (assignment?.role !== 'hotel_admin') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Only hotel administrators can perform this action.',
    })
  }

  return { user, assignment }
}

// Boolean helpers (non-throwing)
export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const clerkUserId = await getVerifiedClerkId(ctx)
  if (!clerkUserId) return false
  const user = await getCurrentUser(ctx, clerkUserId)
  return user?.role === 'room_admin'
}

export async function canAccessHotel(
  ctx: QueryCtx | MutationCtx,
  hotelId: Id<'hotels'>,
): Promise<boolean> {
  try {
    await requireHotelAccess(ctx, hotelId)
    return true
  } catch {
    return false
  }
}
```

---

## Step 4: Update All Convex Functions

Remove `clerkUserId: v.string()` from every `args` object. Remove it from every `handler` call.

### Pattern: Before → After

**Before:**

```typescript
export const create = mutation({
  args: {
    clerkUserId: v.string(),   // remove this
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.clerkUserId)  // remove arg
    ...
  },
})
```

**After:**

```typescript
export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)  // identity from JWT
    ...
  },
})
```

### Full list of functions to update

**`convex/hotels.ts`**
| Function | Old call | New call |
|---|---|---|
| `listForOutsource` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |
| `create` | `requireAdmin(ctx, args.clerkUserId)` | `requireAdmin(ctx)` |
| `update` | `requireHotelManagement(ctx, args.clerkUserId, args.hotelId)` | `requireHotelManagement(ctx, args.hotelId)` |
| `softDelete` | `requireHotelManagement(ctx, args.clerkUserId, args.hotelId)` | `requireHotelManagement(ctx, args.hotelId)` |
| `restore` | `requireHotelManagement(ctx, args.clerkUserId, args.hotelId)` | `requireHotelManagement(ctx, args.hotelId)` |

**`convex/rooms.ts`**
| Function | Old call | New call |
|---|---|---|
| `getByHotelWithLiveState` | `requireHotelAccess(ctx, args.clerkUserId, ...)` | `requireHotelAccess(ctx, ...)` |
| `create` | `requireHotelAccess(ctx, args.clerkUserId, ...)` | `requireHotelAccess(ctx, ...)` |
| `update` | `requireHotelAccess(ctx, args.clerkUserId, ...)` | `requireHotelAccess(ctx, ...)` |
| `updateStatus` | `requireHotelAccess(ctx, args.clerkUserId, ...)` | `requireHotelAccess(ctx, ...)` |
| `softDelete` | `requireHotelAccess(ctx, args.clerkUserId, ...)` | `requireHotelAccess(ctx, ...)` |
| `restore` | `requireHotelAccess(ctx, args.clerkUserId, ...)` | `requireHotelAccess(ctx, ...)` |

**`convex/bookings.ts`**
| Function | Old call | New call |
|---|---|---|
| `get` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |
| `getByUser` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |
| `getByHotel` | `requireHotelAccess(ctx, args.clerkUserId, ...)` / `requireUser(ctx, args.clerkUserId)` | `requireHotelAccess(ctx, ...)` / `requireUser(ctx)` |
| `getByRoom` | `requireHotelAccess(ctx, args.clerkUserId, ...)` | `requireHotelAccess(ctx, ...)` |
| `holdRoom` | `requireCustomer(ctx, args.clerkUserId)` | `requireCustomer(ctx)` |
| `walkInBooking` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |
| `confirmBooking` | `requireCustomer(ctx, args.clerkUserId)` | `requireCustomer(ctx)` |
| `cancelBooking` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |
| `updateStatus` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |
| `acceptCashPayment` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |
| `outsourceBooking` | `requireUser(ctx, args.clerkUserId)` + `requireHotelAccess(ctx, args.clerkUserId, ...)` | `requireUser(ctx)` + `requireHotelAccess(ctx, ...)` |
| `getEnriched` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |
| `getMyBookingsEnriched` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |

**`convex/ratings.ts`**
| Function | Old call | New call |
|---|---|---|
| `getMyRatingForHotel` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |
| `upsertRating` | `requireCustomer(ctx, args.clerkUserId)` | `requireCustomer(ctx)` |
| `softDeleteRating` | `requireHotelManagement(ctx, args.clerkUserId, ...)` | `requireHotelManagement(ctx, ...)` |
| `getHotelRatingsAdmin` | `requireHotelAccess(ctx, args.clerkUserId, ...)` | `requireHotelAccess(ctx, ...)` |

**`convex/hotelStaff.ts`**
| Function | Old call | New call |
|---|---|---|
| `listAllUsers` | `requireAdmin(ctx, args.clerkUserId)` | `requireAdmin(ctx)` |
| `getByUserId` | `requireUser(ctx, args.clerkUserId)` | `requireUser(ctx)` |
| `getByHotelId` | `requireHotelAccess(ctx, args.clerkUserId, ...)` | `requireHotelAccess(ctx, ...)` |
| `assign` | `requireAdmin(ctx, args.clerkUserId)` | `requireAdmin(ctx)` |
| `unassign` | `requireAdmin(ctx, args.clerkUserId)` | `requireAdmin(ctx)` |

**`convex/guestProfiles.ts`**

The local `requireHotelStaffOrAdmin(ctx, clerkUserId)` helper must be rewritten to take no `clerkUserId`:

```typescript
// Before
async function requireHotelStaffOrAdmin(ctx: any, clerkUserId: string) {
  const user = await requireUser(ctx, clerkUserId)
  ...
}

// After - type ctx properly too, remove the `any`
async function requireHotelStaffOrAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  if (user.role === 'room_admin') return user

  const assignment = await getHotelAssignment(ctx, user._id)
  if (!assignment || !['hotel_admin', 'hotel_cashier'].includes(assignment.role)) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Hotel staff access required.',
    })
  }
  return user
}
```

Then update `findOrCreate`, `search`, and `get` to remove `clerkUserId` from their args and calls.

**`convex/users.ts`**

`getByClerkId` is a special case. Currently the frontend passes `user.id` to fetch the current
user's profile. After the refactor, the frontend gets the user's own profile without passing an ID,
since the backend can derive it from the JWT.

```typescript
// New: fetch the calling user's own profile (no args needed)
export const getMe = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id('users'),
      _creationTime: v.number(),
      clerkUserId: v.string(),
      email: v.string(),
      role: v.union(v.literal('customer'), v.literal('room_admin')),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .unique()
  },
})
```

Keep `getByClerkId` only if admin lookups of other users' profiles are needed. If it stays,
gate it with `requireAdmin(ctx)` so arbitrary profile lookups are prevented.

---

## Step 5: Update the Frontend

Every place `user.id` is passed as `clerkUserId` to a Convex call must be removed.

### Profile fetching

Replace all `useQuery(api.users.getByClerkId, { clerkUserId: user?.id })` calls with:

```typescript
// Before
const profile = useQuery(
  api.users.getByClerkId,
  user?.id ? { clerkUserId: user.id } : 'skip',
)

// After
const profile = useQuery(api.users.getMe)
```

### Mutations

Remove `clerkUserId` from every mutation call. Example from `hotels.create`:

```typescript
// Before
createHotel({ clerkUserId: user.id, name, address, city, country })

// After
createHotel({ name, address, city, country })
```

Apply this same removal to every mutation and query call across these files:

- `src/routes/_authenticated.tsx`
- `src/routes/admin/hotels/index/components/-HotelModal.tsx`
- `src/routes/admin/hotels/$hotelId/components/-RoomModal.tsx`
- `src/routes/admin/hotels/$hotelId/components/-HotelEditModal.tsx`
- `src/routes/admin/bookings/index.tsx`
- `src/routes/admin/bookings/$bookingId.tsx`
- `src/routes/admin/bookings/components/-OutsourceModal.tsx`
- `src/routes/admin/walk-in/index.tsx`
- `src/routes/admin/users/index.tsx`
- `src/routes/admin/users/components/-AssignModal.tsx`
- `src/routes/_authenticated/bookings.tsx`
- `src/routes/hotels.$hotelId.tsx`
- `src/routes/hotels.$hotelId/components/-BookingModal.tsx`
- `src/routes/select-location.tsx`
- `src/routes/post-login.tsx`

### `hotelStaff.getByUserId`

This query currently takes both `clerkUserId` and `userId`. After the refactor, the backend derives
the calling user from the JWT, so `userId` is the only arg needed if fetching another user's
assignment (admin use case). For the common case of fetching the caller's own assignment,
add a `getMyAssignment` query with no args.

---

## Roles Reference

| Role            | Where Stored      | Auth Helper                                                  |
| --------------- | ----------------- | ------------------------------------------------------------ |
| `room_admin`    | `users.role`      | `requireAdmin(ctx)`                                          |
| `customer`      | `users.role`      | `requireCustomer(ctx)`                                       |
| `hotel_admin`   | `hotelStaff.role` | `requireHotelManagement(ctx, hotelId)`                       |
| `hotel_cashier` | `hotelStaff.role` | `requireHotelAccess(ctx, hotelId)` + check `assignment.role` |

---

## Migration Checklist

1. [ ] Create JWT template in Clerk Dashboard named `convex`
2. [ ] Update `src/integrations/convex/provider.tsx` to call `convexQueryClient.convexClient.setAuth()`
3. [ ] Rewrite `convex/lib/auth.ts` - remove all `clerkUserId` parameters
4. [ ] Add `getMe` query to `convex/users.ts`; gate `getByClerkId` with `requireAdmin`
5. [ ] Update `convex/hotels.ts` - remove `clerkUserId` from all args and calls
6. [ ] Update `convex/rooms.ts` - remove `clerkUserId` from all args and calls
7. [ ] Update `convex/bookings.ts` - remove `clerkUserId` from all args and calls
8. [ ] Update `convex/ratings.ts` - remove `clerkUserId` from all args and calls
9. [ ] Update `convex/hotelStaff.ts` - remove `clerkUserId` from all args and calls; add `getMyAssignment`
10. [ ] Update `convex/guestProfiles.ts` - rewrite local helper, remove `clerkUserId` from all args
11. [ ] Update all frontend files to remove `clerkUserId` from query/mutation args
12. [ ] Replace `getByClerkId` usage with `getMe` on the frontend
13. [ ] Run `npx convex dev` and verify no TypeScript errors in the Convex functions
14. [ ] Test sign-in, sign-out, and re-sign-in to verify token refresh works
15. [ ] Test each role: customer booking flow, hotel staff walk-in, room admin hotel management
