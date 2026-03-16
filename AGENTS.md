# AGENTS.md - Coding Agent Guidelines

This document provides essential guidance for AI coding agents working in this repository.

## Project Overview

Hotel Management System built with:

- **Frontend**: TanStack Start (React Router + React 19), Tailwind CSS v4, Clerk Auth
- **Backend**: Convex (serverless database + functions)
- **Language**: TypeScript (strict mode)

## Build / Lint / Test Commands

```bash
# Development server (port 3000)
npm run dev

# Production build
npm run build

# Run all tests
npm run test

# Run a single test file
npx vitest run path/to/file.test.ts

# Run tests matching a pattern
npx vitest run -t "test name pattern"

# Lint (uses @tanstack/eslint-config)
npm run lint

# Format (Prettier)
npm run format

# Check and fix both (recommended before commits)
npm run check

# Convex development server (run in separate terminal)
npx convex dev

# Generate Convex types once (preferred for CI/local checks)
npx convex dev --once
```

### Convex Codegen Rule

- Never use `npx convex codegen` in this repository.
- Always generate Convex types using `npx convex dev --once`.

## Project Structure

```
hotel_management/
├── src/
│   ├── routes/          # TanStack Router file-based routes
│   ├── components/      # Shared React components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   └── integrations/    # Third-party integrations (Clerk, Convex)
├── convex/
│   ├── schema.ts        # Database schema definition
│   ├── lib/             # Shared server utilities (auth.ts, dates.ts)
│   └── _generated/      # Auto-generated types (DO NOT EDIT)
├── doc/                 # Documentation files
└── scripts/             # Build and seed scripts
```

## Code Style Guidelines

### TypeScript

- **Strict mode enabled**: All variables must be typed, no implicit `any`
- Use explicit return types on Convex functions
- Use `interface` for object shapes, `type` for unions/aliases
- Import types using standard imports (verbatimModuleSyntax is false)

### Imports

```typescript
// 1. External libraries first
import { createFileRoute, Link } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'

// 2. Internal absolute imports (use @/ alias)
import { api } from '@/convex/_generated/api'
import Header from '@/components/Header'

// 3. Relative imports last
import { formatDate } from '../lib/dates'
```

### React Components

- Use functional components with TypeScript props
- Prefer named exports for components
- Use `useState`, `useEffect` from React 19
- Route components: `export const Route = createFileRoute('/path')({...})`

```typescript
interface Props {
  title: string
  onSubmit: (value: string) => void
}

export function MyComponent({ title, onSubmit }: Props) {
  const [value, setValue] = useState('')
  return (...)
}
```

### Convex Functions

- **Always** define `args` and `returns` validators
- Use `ConvexError` for domain errors with structured codes
- Import validators from `convex/values`

```typescript
import { query, mutation } from './_generated/server'
import { v, ConvexError } from 'convex/values'

export const myQuery = query({
  args: { id: v.id('tableName') },
  returns: v.union(v.object({...}), v.null()),
  handler: async (ctx, args) => {
    // Implementation
  },
})
```

### Convex Schema (from .cursorrules)

- System fields `_id` and `_creationTime` are automatic - don't define them
- Use `v.id('tableName')` for references
- Use `v.union(v.literal(...), ...)` for enums
- Add indexes for frequently queried fields

```typescript
// Example pattern from schema.ts
users: defineTable({
  clerkUserId: v.string(),
  role: v.union(v.literal('customer'), v.literal('room_admin')),
  createdAt: v.number(),
})
  .index('by_clerk_user_id', ['clerkUserId'])
  .index('by_role', ['role']),
```

### Error Handling

Convex errors use structured codes:

```typescript
throw new ConvexError({
  code: 'NOT_FOUND', // Resource not found
  // code: 'FORBIDDEN',     // Permission denied
  // code: 'UNAUTHORIZED',  // Not authenticated
  // code: 'INVALID_INPUT', // Validation error
  // code: 'CONFLICT',      // Resource conflict
  // code: 'INVALID_STATE', // Invalid operation state
  message: 'Human-readable description',
})
```

### Naming Conventions

| Type               | Convention                 | Example                       |
| ------------------ | -------------------------- | ----------------------------- |
| Components         | PascalCase                 | `BookingModal`, `Header`      |
| Files (components) | PascalCase.tsx             | `Header.tsx`                  |
| Files (routes)     | kebab-case.tsx             | `select-location.tsx`         |
| Functions          | camelCase                  | `calculateNights`, `holdRoom` |
| Variables          | camelCase                  | `checkInDate`, `totalPrice`   |
| Constants          | SCREAMING_SNAKE            | `MAX_STAY_NIGHTS`             |
| Convex tables      | camelCase plural           | `hotels`, `bookings`          |
| Convex indexes     | snake*case with by* prefix | `by_hotel`, `by_status`       |

### Formatting

- Prettier handles all formatting (run `npm run format`)
- No trailing commas in function arguments
- 2-space indentation
- Single quotes for strings
- No semicolons (Prettier default)

### Authentication Patterns

**CRITICAL: Identity is always derived from the JWT token — NEVER from client-supplied arguments.**

All Convex public functions (queries/mutations) authenticate the caller via
`ctx.auth.getUserIdentity()`, which Convex populates from the Clerk JWT that
`ConvexProviderWithClerk` forwards automatically. No `clerkUserId` argument
should ever appear in a public function's `args` validator.

Frontend — fetching the current user profile & hotel assignment:

```typescript
const { user } = useUser() // From @clerk/clerk-react

// Current user's DB profile (replaces the old getByClerkId pattern)
const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

// Current user's hotel assignment (for staff roles)
const hotelAssignment = useQuery(
  api.hotelStaff.getMyAssignment,
  profile ? {} : 'skip',
)
```

Frontend — calling mutations (no `clerkUserId` in args):

```typescript
const hold = useMutation(api.bookings.holdRoom)

await hold({
  roomId: room._id,
  checkInDate: '2025-03-01',
  checkOutDate: '2025-03-03',
  // clerkUserId is NOT passed — identity comes from the JWT
})
```

Backend (Convex) — auth helpers from `convex/lib/auth.ts`:

```typescript
import {
  requireUser,    // returns user doc, throws UNAUTHORIZED / NOT_FOUND
  requireAdmin,   // returns user doc with role=room_admin, throws FORBIDDEN
  requireCustomer,// returns user doc with role=customer, throws FORBIDDEN
  requireHotelAccess,     // verifies staff is assigned to the hotel
  requireHotelManagement, // verifies hotel_admin role for the hotel
  getCurrentUser, // returns user doc or null (no throw)
  isAdmin,        // boolean check
  isCustomer,     // boolean check
  canAccessHotel, // boolean check
  canManageHotel, // boolean check
} from './lib/auth'

// In any handler — zero arguments needed, identity from JWT:
const user = await requireUser(ctx)
const admin = await requireAdmin(ctx)
const customer = await requireCustomer(ctx)
await requireHotelAccess(ctx, args.hotelId)
```

**Hybrid role model:**

| Role           | Source                | Scope            |
| -------------- | --------------------- | ---------------- |
| `customer`     | Clerk metadata (signup) | Global         |
| `room_admin`   | Clerk metadata (signup) | Global         |
| `hotel_admin`  | Convex `hotelStaff` table | Per-hotel    |
| `hotel_cashier`| Convex `hotelStaff` table | Per-hotel    |

**Files involved:**
- `convex/auth.config.ts` — tells Convex how to validate Clerk JWTs
- `src/integrations/convex/provider.tsx` — `ConvexProviderWithClerk` bridges tokens
- `convex/lib/auth.ts` — all auth helper functions (JWT-based)

### Date Handling

- Store dates as `YYYY-MM-DD` strings for booking dates
- Use timestamps (`number`) for `createdAt`, `updatedAt`
- Use utilities from `convex/lib/dates.ts`: `parseDate`, `formatDate`, `calculateNights`

### Pricing

- Store prices in **cents** (`number`), not dollars
- Convert for display: `(priceInCents / 100).toFixed(2)`

## Styling

- Tailwind CSS v4 (imported via `@tailwindcss/vite`)
- Dark theme: `bg-slate-900`, `text-slate-200`, `border-slate-800`
- Accent color: `amber-400`/`amber-500`
- Rounded corners: `rounded-xl` or `rounded-2xl`
- Use `transition-colors` or `transition-all` for interactions

## Important Notes

1. **Never edit** `convex/_generated/*` - these are auto-generated
2. **Run `npx convex dev`** when developing to sync schema changes
3. Use `'skip'` as query argument to conditionally skip queries
4. Audit logging: Use `createAuditLog()` for admin mutations
5. Soft deletes: Use `isDeleted` boolean, never hard delete
6. **NEVER pass `clerkUserId` as an argument** to any public Convex function — identity MUST be derived from the JWT via `ctx.auth.getUserIdentity()` inside the handler
