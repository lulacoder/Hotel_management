Implement a role-based authentication system for a Hotel Management application using TanStack Start (React), Convex, and Clerk with Email OTP.

## Tech Stack & Versions (Verified 2025)
- **TanStack Start**: Latest (file-based routing, SSR-enabled)
- **Convex**: Latest (schema definitions, mutations, queries, HTTP actions)
- **Clerk React SDK**: ^5.51.0 (@clerk/clerk-react or @clerk/tanstack-start)
- **Clerk Backend**: ^2.17.2 (for webhook verification using svix)

## Project Structure
app/
├── routes/
│   ├── __root.tsx              # ClerkProvider wraps entire app
│   ├── index.tsx               # Public landing page
│   ├── sign-in.tsx             # Email OTP login
│   ├── sign-up.tsx             # Email OTP signup (or combined)
│   ├── post-login.tsx          # Role-based redirect after auth
│   ├── _authenticated.tsx      # Layout: requires login
│   │   ├── select-location.tsx # Customer: post-login location picker
│   │   └── bookings.tsx        # Customer: my bookings
│   └── admin.tsx               # Layout: requires login + admin role
│       └── index.tsx           # Admin dashboard (protected)
├── lib/
│   ├── convex.ts               # Convex client setup
│   └── clerk.ts                # Clerk utility functions
convex/
├── schema.ts                   # User table with role field
├── users.ts                    # User queries and mutations
└── clerk.ts                    # Webhook handler for user.created events
Copy

## Requirements

### 1. Clerk Configuration (Email OTP Only)
- Disable password authentication entirely
- Enable Email OTP (verification code) only
- No SMS for MVP
- Admins are created manually in Clerk Dashboard (detected via webhook)

### 2. Convex Schema
Table: `users`
- `clerkUserId`: string (indexed)
- `email`: string (indexed)
- `role`: "customer" | "room_admin"
- `createdAt`: number

### 3. Webhook Logic (Critical)
When Clerk sends `user.created` event:
- Check `event.data.created_by` field
- If `created_by` exists (not null) → User created in Dashboard → role: "room_admin"
- If `created_by` is null → Self-signup → role: "customer"

### 4. Route Protection Strategy

**Public Routes**: `/`, `/sign-in`, `/sign-up`

**Authenticated Routes** (`/_authenticated/*`):
- Requires Clerk session
- Fetches role from Convex
- If role is "room_admin" → redirect to `/admin`
- If role is "customer" → show customer content

**Admin Routes** (`/admin/*`):
- Requires Clerk session
- Fetches role from Convex
- If role is NOT "room_admin" → show "Access Denied"
- If role is "room_admin" → show admin content

### 5. Post-Login Flow
After successful authentication:
1. User lands on `/post-login` (or equivalent)
2. Query Convex for user profile by clerkId
3. Redirect based on role:
   - `room_admin` → `/admin`
   - `customer` → `/select-location`

### 6. File-by-File Implementation

Create these files in order:

**convex/schema.ts**
- Define users table with proper indexes

**convex/users.ts**
- `createUser`: mutation to create user (idempotent - check exists first)
- `getByClerkId`: query to fetch user by clerkUserId

**convex/clerk.ts**
- HTTP action at path `/clerk`
- Verify webhook signature using svix library
- Handle `user.created` event
- Call `users.createUser` with appropriate role

**app/routes/__root.tsx**
- Wrap with ClerkProvider
- Use `VITE_CLERK_PUBLISHABLE_KEY` from env

**app/routes/sign-in.tsx**
- Use Clerk's SignIn component OR custom Email OTP flow
- Force redirect to `/post-login` after success

**app/routes/post-login.tsx**
- Check `useUser().isLoaded`
- Query `api.users.getByClerkId` with `user.id`
- While loading: show "Loading..."
- After load: redirect based on `profile.role`

**app/routes/_authenticated.tsx**
- Layout route
- `beforeLoad`: check Clerk session, redirect to `/sign-in` if none
- Component: query user role, redirect admins to `/admin`
- Render `<Outlet />` for customers

**app/routes/_authenticated/select-location.tsx**
- Simple component: "Location Selection Page"
- Protected by parent layout

**app/routes/admin.tsx**
- Layout route
- `beforeLoad`: check Clerk session
- Component: query user role
- If not admin: render Access Denied UI
- If admin: render `<Outlet />`

**app/routes/admin/index.tsx**
- Admin dashboard content
- Protected by parent layout

### 7. Environment Variables
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
Copy

### 8. Dependencies to Install
```bash
npm install @clerk/tanstack-start @clerk/clerk-react convex
cd convex && npm install svix
9. Webhook Configuration Steps
Deploy Convex to get site URL: https://your-deployment.convex.site
In Clerk Dashboard → Webhooks → Add Endpoint
URL: https://your-deployment.convex.site/clerk
Select events: user.created
Copy signing secret
Set in Convex: npx convex env set CLERK_WEBHOOK_SECRET=whsec_...
10. Critical Implementation Details
Idempotency: In createUser mutation, check if user exists by clerkUserId before inserting
Loading States: Always check isLoaded from Clerk and Convex queries before rendering
Type Safety: Use generated Convex types (api.users.getByClerkId)
Security: Webhook must verify signature using CLERK_WEBHOOK_SECRET
Role Detection: Use created_by field in webhook payload, not email domain
11. Testing Checklist
[ ] Sign up as new customer → lands on /select-location
[ ] Create user in Clerk Dashboard → lands on /admin
[ ] Customer tries to access /admin → sees Access Denied
[ ] Admin can access /admin and see dashboard
[ ] Webhook creates user in Convex with correct role
Acceptance Criteria
Email OTP works for both signup and login
Users created via Dashboard become admins automatically
Self-registered users become customers
Route protection works: customers can't see admin, admins can't see customer flows (redirected appropriately)
No password authentication anywhere
Webhook properly verifies signatures and handles idempotency
Implement all files following TanStack Start file-based routing conventions, Convex schema/function patterns, and Clerk React SDK latest patterns (v5.51.0+).
Copy

---

## Additional Context for You

**Key updates from latest docs:**

1. **TanStack Start** uses file-based routing exclusively (no code-based routing in Start) [^14^]
2. **Clerk React SDK** v5.51.0+ requires checking `isLoaded` before rendering auth UI [^21^][^22^]
3. **Clerk Webhook** uses `svix` library for signature verification (included in prompt) [^21^]
4. **Convex HTTP Actions** should use `.site` URL for webhooks, `.cloud` for client SDK calls

**Your specific deployment:**
- Site URL (webhooks): `https://earnest-spoonbill-619.convex.site`
- Client URL: `https://earnest-spoonbill-619.convex.cloud`