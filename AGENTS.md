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

# React Doctor audit (use the latest real tool output)
npx react-doctor@latest --verbose

# Convex development server (run in separate terminal)
npx convex dev

# Generate Convex types once (preferred for CI/local checks)
npx convex dev --once
```

## Never turn off typechecking when deploying to Convex

Never run `npx convex dev --notypechecking`.

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
├── doc/                 # Documentation files grouped by feature; see doc/README.md
└── scripts/             # Build and seed scripts
```

## Code Style Guidelines

### TypeScript

- **Strict mode enabled**: All variables must be typed, no implicit `any`
- Use explicit return types on Convex functions
- Use `interface` for object shapes, `type` for unions/aliases
- Import types using standard imports (verbatimModuleSyntax is false)

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

TypeScript Preferences

- If your TypeScript code looks like a Python dev wrote it, it's bad TypeScript code.
- Avoid one-liners that are just casting wrappers.
- Write TypeScript in ways that Matt Pocock and Theo would be proud of.
- Comments are a great way to clarify functions and how code is used. Don't comment every line, but feel free to concisely describe how functions/classes are used above their definitions. Keep comments up to date when making changes.

## Tech & Code Style Preferences

- Follow YAGNI (You Aren't Gonna Need It) principles — do not add unrequested code or over-architect solutions.

## Comments

- Every function definition gets a short one-line purpose comment immediately above it. This includes exported functions, local helpers, nested functions, handlers, and callbacks.
- For an inline anonymous callback, place its one-line comment above the containing operation when inserting it inside the expression would hurt readability.
- For a Convex query, mutation, or action, state who can call it and any notable side effects when those details are not obvious.
- Add a one-line intent comment immediately before every non-obvious domain operation or side-effect block, especially lifecycle transitions, payment changes, audit writes, provider calls, cleanup jobs, and permission-sensitive actions. State the business effect, not the method name.
- Do not leave a newly added multi-line block unexplained just because the containing function already has a purpose comment.
- Use extra inline comments only for non-obvious logical steps or to explain why a critical line exists. Do not narrate simple setters, readable guards, or ordinary assignments.
- Keep comments concise, in sentence case, and without a trailing period. Update them whenever behavior changes.



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

### Developer Experience Comments

- When adding or refactoring a non-trivial component, hook, route helper, or domain function, add a short comment immediately before it that explains what it is responsible for in plain product language.
- Add inline comments for complex flows, side effects, permission checks, multi-step form state, React Doctor fixes, and data transformations where a future maintainer would otherwise need to reverse-engineer intent.
- Keep comments useful and specific. Do not add noisy comments for obvious JSX, simple setters, basic imports, or one-line wrappers.
- Prefer comments that explain why the code exists or what user/business case it protects, not comments that merely restate the syntax.

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
  requireUser, // returns user doc, throws UNAUTHORIZED / NOT_FOUND
  requireAdmin, // returns user doc with role=room_admin, throws FORBIDDEN
  requireCustomer, // returns user doc with role=customer, throws FORBIDDEN
  requireHotelAccess, // verifies staff is assigned to the hotel
  requireHotelManagement, // verifies hotel_admin role for the hotel
  getCurrentUser, // returns user doc or null (no throw)
  isAdmin, // boolean check
  isCustomer, // boolean check
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

| Role            | Source                    | Scope     |
| --------------- | ------------------------- | --------- |
| `customer`      | Clerk metadata (signup)   | Global    |
| `room_admin`    | Clerk metadata (signup)   | Global    |
| `hotel_admin`   | Convex `hotelStaff` table | Per-hotel |
| `hotel_cashier` | Convex `hotelStaff` table | Per-hotel |

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
- Light mode in this app is intentionally subtle and custom. Do not replace it with a flat generic white shadcn look; preserve the soft slate surfaces, restrained contrast, and violet-tinted accents already used across customer and admin screens.
- When adding new translucent slate utilities, prefer opacity values already covered by `src/styles.css` light-mode overrides or add explicit light-mode mappings for them. Hard-coded utilities such as `bg-slate-900/90` or `bg-slate-800/60` can break readability in light mode if they are not mapped.
- Customer-facing overlays and floating UI such as dialogs, sheets, dropdowns, filters, and popovers need explicit light-mode borders, backgrounds, and shadows. Do not assume dark-mode surface classes will stay readable after the global light-theme text overrides apply.
- Customer-side interactive controls must always show clickability. Buttons, tabs, select triggers/items, package cards, and similar controls should use `cursor-pointer` plus visible hover and focus feedback.
- Booking date UX must enforce the same front-end constraints as the backend. If checkout cannot equal check-in, the UI should prevent selecting the same date instead of relying on the mutation to reject it.
- Admin-facing pages should reuse the shared admin utility classes in `src/styles.css` whenever possible. Prefer `admin-surface`, `admin-surface-muted`, `admin-empty-state`, `admin-field`, `admin-select`, `admin-textarea`, `admin-button-*`, `admin-menu-*`, `admin-table-*`, and `admin-modal-*` over route-local one-off styling.
- Admin light mode should feel like the same product as dark mode, not a separate generic theme. Keep the subtle white/slate surfaces, low-contrast borders, restrained shadows, and violet action accents consistent across the admin shell, CRUD pages, modals, menus, tables, and empty states.
- When refactoring admin routes, treat the shell as part of the UI contract. Sidebar navigation, user chrome, dropdown menus, modal panels, and list/detail cards all need explicit light-mode states and should not stay hard-coded to dark-only `slate-900` surfaces.
- Admin modals should keep a structural wrapper contract: `admin-modal-panel` as the flex container, `admin-modal-header` for the fixed title row, `admin-modal-body` for the scrollable content region, and `admin-modal-footer` for actions. Do not place raw modal content directly under the panel without the body wrapper.
- In constrained admin chrome such as the sidebar controls row, prefer compact `ThemeToggle` and `LanguageSwitcher` variants so translated labels do not overflow the layout.

## Important Notes

1. **Never edit** `convex/_generated/*` - these are auto-generated
2. **Run `npx convex dev`** when developing to sync schema changes
3. Use `'skip'` as query argument to conditionally skip queries
4. Audit logging: Use `createAuditLog()` for admin mutations
5. Soft deletes: Use `isDeleted` boolean, never hard delete
6. **NEVER pass `clerkUserId` as an argument** to any public Convex function — identity MUST be derived from the JWT via `ctx.auth.getUserIdentity()` inside the handler

### React Doctor Workflow

- When asked to audit or improve React Doctor findings, run `npx react-doctor@latest --verbose` and use the full diagnostics folder it prints as the source of truth.
- If the task is frontend/performance cleanup, do not edit files under `convex/` unless the user explicitly allows Convex changes for that pass. Treat Convex diagnostics as out of scope and report them separately so backend behavior is not changed accidentally.
- Do not delete files only because React Doctor or deslop reports `unused-file`. First prove they are unreachable from TanStack's generated route tree, `src/router.tsx`, app providers, dynamic imports, and build tooling. If reachability is uncertain, leave the file in place and explain the likely false positive.
- For performance findings, prefer root-cause fixes that preserve app behavior. Re-run React Doctor after changes and also run `npm run build` before handing the work back.

# Agent guidance for this repo

When working in this repository, use the skills below as context triggers.

- Match the task to the closest description.
- Load the linked `SKILL.md` before making changes in that area.
- Keep the block below as the source of truth for skill-to-task mappings.

<!-- intent-skills:start -->

# Skill mappings — when working in these areas, load the linked skill file into context.

skills:

- task: "working with routes, pages, layouts, or navigation"
  load: "node_modules/@tanstack/router-core/skills/router-core/navigation/SKILL.md"

- task: "protecting routes, authentication, or role-based access"
  load: "node_modules/@tanstack/router-core/skills/router-core/auth-and-guards/SKILL.md"

- task: "loading data, caching, loaders, search params, or route data"
  load: "node_modules/@tanstack/router-core/skills/router-core/data-loading/SKILL.md"

- task: "writing server functions, backend actions, or form submissions"
  load: "node_modules/@tanstack/start-client-core/skills/start-core/server-functions/SKILL.md"

- task: "building API routes or HTTP handlers in TanStack Start"
  load: "node_modules/@tanstack/start-client-core/skills/start-core/server-routes/SKILL.md"

- task: "understanding the overall TanStack Start app structure"
load: "node_modules/@tanstack/start-client-core/skills/start-core/SKILL.md"
<!-- intent-skills:end -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
