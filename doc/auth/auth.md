# Authentication Flow (Clerk + Convex + TanStack Router)

This document describes the end-to-end authentication flow in this app, how users are signed in and routed, and how their profile is created and used for authorization.

## Overview

The app uses:

- **Clerk** for authentication and user sessions.
- **Convex** for user profiles and role data.
- **TanStack Router (React Start)** for routing.

Key routes and providers:

- Root shell: [src/routes/__root.tsx](../../src/routes/__root.tsx)
- Clerk provider: [src/integrations/clerk/provider.tsx](../../src/integrations/clerk/provider.tsx)
- Convex provider: [src/integrations/convex/provider.tsx](../../src/integrations/convex/provider.tsx)
- Post-login router: [src/routes/post-login.tsx](../../src/routes/post-login.tsx)
- Sign-in routes: [src/routes/sign-in.tsx](../../src/routes/sign-in.tsx), [src/routes/sign-in.$.tsx](../../src/routes/sign-in.$.tsx)
- Sign-up routes: [src/routes/sign-up.tsx](../../src/routes/sign-up.tsx), [src/routes/sign-up.$.tsx](../../src/routes/sign-up.$.tsx)

## Environment & Configuration

### Required environment variables

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`
- `CONVEX_DEPLOYMENT` (for Convex deployment and webhook setup)

These are typically stored in `.env.local`.

### Providers wiring

In [src/routes/__root.tsx](../../src/routes/__root.tsx), the app is wrapped with:

1. `ClerkProvider` (authentication + session)
2. `ConvexProvider` (data client)

Order matters: Clerk initializes the session before Convex is used to query profile data.

## End-to-End Flow

### 1) Visitor opens the app

- The landing page is [src/routes/index.tsx](../../src/routes/index.tsx).
- If a user is already signed in, it links/redirects them to `/post-login`.
- Otherwise, it shows sign-in/sign-up CTAs.

### 2) Sign-in and sign-up

There are two route variants for each auth screen:

- `/sign-in` and `/sign-up` (normal route)
- `/sign-in/*` and `/sign-up/*` (catch-all routes) to support Clerk’s internal routing states.

These are implemented in:

- [src/routes/sign-in.tsx](../../src/routes/sign-in.tsx)
- [src/routes/sign-in.$.tsx](../../src/routes/sign-in.$.tsx)
- [src/routes/sign-up.tsx](../../src/routes/sign-up.tsx)
- [src/routes/sign-up.$.tsx](../../src/routes/sign-up.$.tsx)

Both Clerk UIs are configured with:

- `routing="path"`
- `path="/sign-in"` or `path="/sign-up"`
- `forceRedirectUrl="/post-login"`

This ensures Clerk always sends users to `/post-login` after successful sign-in or sign-up.

### 3) Post-login routing (role-aware)

After successful auth, the user lands on `/post-login`.

In [src/routes/post-login.tsx](../../src/routes/post-login.tsx), the flow is:

1. `useUser()` loads the Clerk user.
2. If user is not signed in, redirect to `/sign-in`.
3. Once Clerk is loaded, query Convex via `api.users.getByClerkId`.
4. If the profile exists, route by role:
   - `room_admin` → `/admin`
   - `customer` → `/select-location`
5. If the profile is not found yet, a loading screen remains visible. This is expected while the profile is being created.

**Important:** The `/post-login` route is explicitly configured as **SPA-only (SSR disabled)** to avoid server-side access to Clerk/Convex client-only APIs.

### 4) User profile creation in Convex

Convex stores app-specific user data and roles. The profile is created server-side by a webhook (see Convex + Clerk webhook configuration in deployment). The Convex functions are defined in:

- [convex/users.ts](../../convex/users.ts)

Key functions:

- `getByClerkId` (query): returns user by `clerkUserId`
- `createUser` (internal mutation): creates user if missing

The `createUser` mutation is intended to be called by the Clerk webhook handler. It is idempotent and safe to retry.

### 5) Authenticated routes

Authenticated routes are grouped under the `_authenticated` routes in:

- [src/routes/_authenticated.tsx](../../src/routes/_authenticated.tsx)
- [src/routes/_authenticated/*](../../src/routes/_authenticated)

These routes should assume a valid Clerk session and a valid Convex profile.

## Error Handling & Common Issues

### 1) 500 errors on `/post-login`

Cause: server-side rendering (SSR) trying to run Clerk or Convex client APIs.

Fix: ensure `/post-login` is SPA-only and avoid SSR. This is already set in [src/routes/post-login.tsx](../../src/routes/post-login.tsx).

### 2) Sign-in or sign-up route fails to compile

Cause: corrupted route files or invalid imports.

Fix: use valid route component files as in [src/routes/sign-in.$.tsx](../../src/routes/sign-in.$.tsx) and [src/routes/sign-up.$.tsx](../../src/routes/sign-up.$.tsx).

### 3) Stuck on “Loading your profile…”

Cause: Convex profile not created yet.

Checklist:

- Ensure Clerk webhook is configured to call Convex `createUser`.
- Ensure `VITE_CONVEX_URL` and `CONVEX_DEPLOYMENT` are set correctly.
- Confirm Convex deployment is running and indexes exist.

## Security Notes

- Clerk handles authentication, token issuance, and session management.
- Convex stores only app-specific profile data (role, email, etc.).
- Role-based routing is enforced in the client (post-login) and should also be enforced server-side in Convex functions and admin UI actions.

## Quick Trace (Happy Path)

1. User signs in via Clerk.
2. Clerk redirects to `/post-login`.
3. Post-login loads Clerk user.
4. Convex returns profile with role.
5. User is routed to their role-appropriate landing page.