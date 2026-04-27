# User & Hotel Staff Management - Implementation Plan

## Overview

We're implementing a 4-tier role system for the hotel management application:

- **`room_admin`** (global) - Super admin with full access to everything
- **`customer`** (global) - Regular users who book hotels
- **`hotel_admin`** (hotel-specific) - Manages one hotel's rooms & bookings
- **`hotel_cashier`** (hotel-specific) - Limited access to one hotel (check-in/out, refunds)

All roles access `/admin` but see different features based on permissions.

---

## Design Decisions

Based on user requirements:

- ✅ Only **room_admin** can assign users to hotels
- ✅ **room_admin** keeps full access even when assigned to a hotel
- ✅ **hotel_cashier** only sees **Bookings** navigation item
- ✅ No email notifications for assignments
- ✅ Users can only be assigned to **one hotel** at a time
- ✅ Hotel assignment works **alongside** global roles (not replacing them)

---

## PHASE 1: DATABASE SCHEMA

### File: `convex/schema.ts`

Add new table after the `users` table:

```typescript
hotelStaff: defineTable({
  userId: v.id('users'),
  hotelId: v.id('hotels'),
  role: v.union(v.literal('hotel_admin'), v.literal('hotel_cashier')),
  assignedAt: v.number(),
  assignedBy: v.id('users'), // Who assigned them
})
  .index('by_user', ['userId'])
  .index('by_hotel', ['hotelId'])
```

**Rationale:**

- Separate table keeps global roles (`customer`, `room_admin`) distinct from hotel-specific roles
- Allows easy querying of "who's assigned where"
- Enables audit trail of assignments
- One hotel per user enforced in mutation logic (not database constraint)

---

## PHASE 2: BACKEND - NEW FILE

### File: `convex/hotelStaff.ts`

Create a new file with the following functions:

#### Queries:

**1. `listAllUsers`**

- **Purpose:** List all users with their hotel assignments (for the user management page)
- **Args:** `{ clerkUserId: string }` (current admin)
- **Returns:** Array of users with optional hotel assignment data
- **Auth:** Requires `room_admin` role
- **Logic:**
  1. Verify current user is `room_admin`
  2. Get all users from database
  3. For each user, look up their hotel assignment (if any)
  4. If assigned, get hotel name and city
  5. Return combined data

**2. `getByUserId`**

- **Purpose:** Get hotel assignment for a specific user
- **Args:** `{ userId: Id<'users'> }`
- **Returns:** Hotel assignment object or null
- **Auth:** Public (used for checking user's own assignment)
- **Logic:** Query `hotelStaff` table by `by_user` index

**3. `getByHotelId`**

- **Purpose:** Get all staff assigned to a specific hotel
- **Args:** `{ hotelId: Id<'hotels'> }`
- **Returns:** Array of assignments with user emails
- **Auth:** Public (but should be filtered by hotel access)
- **Logic:**
  1. Query assignments by `by_hotel` index
  2. For each assignment, get user email
  3. Return combined data

#### Mutations:

**1. `assign`**

- **Purpose:** Assign a user to a hotel with a specific role
- **Args:**
  - `clerkUserId: string` (current admin)
  - `targetUserId: Id<'users'>` (user to assign)
  - `hotelId: Id<'hotels'>`
  - `role: 'hotel_admin' | 'hotel_cashier'`
- **Returns:** `Id<'hotelStaff'>` (assignment ID)
- **Auth:** Requires `room_admin` role
- **Validation:**
  1. Verify current user is `room_admin`
  2. Verify target user exists
  3. Check if target user already has an assignment (throw error if yes)
  4. Verify hotel exists and is not deleted
- **Logic:**
  1. Create assignment record in `hotelStaff` table
  2. Create audit log entry
  3. Return assignment ID

**2. `unassign`**

- **Purpose:** Remove a user's hotel assignment
- **Args:**
  - `clerkUserId: string` (current admin)
  - `targetUserId: Id<'users'>` (user to unassign)
- **Returns:** `null`
- **Auth:** Requires `room_admin` role
- **Validation:**
  1. Verify current user is `room_admin`
  2. Find existing assignment (throw error if none)
- **Logic:**
  1. Delete assignment record
  2. Create audit log entry
  3. Return null

---

## PHASE 3: BACKEND - UPDATE AUTH HELPERS

### File: `convex/lib/auth.ts`

Add the following new helper functions at the end of the file:

#### 1. `getHotelAssignment`

```typescript
async function getHotelAssignment(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<Doc<'hotelStaff'> | null>
```

- **Purpose:** Get user's hotel assignment (if any)
- **Returns:** Assignment document or null

#### 2. `canAccessHotel`

```typescript
async function canAccessHotel(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
  hotelId: Id<'hotels'>,
): Promise<boolean>
```

- **Purpose:** Check if user can access a specific hotel
- **Logic:**
  - `room_admin`: Always returns `true` (can access all hotels)
  - `hotel_admin/cashier`: Returns `true` only for their assigned hotel
  - `customer`: Returns `false`

#### 3. `requireHotelAccess`

```typescript
async function requireHotelAccess(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
  hotelId: Id<'hotels'>,
): Promise<{ user: Doc<'users'>; assignment: Doc<'hotelStaff'> | null }>
```

- **Purpose:** Require user to have access to hotel (or be `room_admin`)
- **Throws:** `ConvexError` with code `FORBIDDEN` if no access
- **Returns:** User document and assignment (null for `room_admin`)

#### 4. `canManageHotel`

```typescript
async function canManageHotel(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
  hotelId: Id<'hotels'>,
): Promise<boolean>
```

- **Purpose:** Check if user can perform admin actions on a hotel
- **Logic:**
  - `room_admin`: Returns `true`
  - `hotel_admin`: Returns `true` for their assigned hotel
  - `hotel_cashier`: Returns `false`
  - `customer`: Returns `false`

#### 5. `requireHotelManagement`

```typescript
async function requireHotelManagement(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
  hotelId: Id<'hotels'>,
): Promise<{ user: Doc<'users'>; assignment: Doc<'hotelStaff'> | null }>
```

- **Purpose:** Require user to be able to manage hotel (admin actions)
- **Throws:** `ConvexError` if user cannot manage (e.g., cashier)
- **Returns:** User document and assignment

---

## PHASE 4: BACKEND - UPDATE EXISTING MUTATIONS (Examples)

### File: `convex/rooms.ts`

**Update `create` mutation:**

```typescript
// OLD:
await requireAdmin(ctx, args.clerkUserId)

// NEW:
const { user, assignment } = await requireHotelAccess(
  ctx,
  args.clerkUserId,
  args.hotelId,
)

// Only room_admin or hotel_admin can create rooms
if (user.role !== 'room_admin' && assignment?.role !== 'hotel_admin') {
  throw new ConvexError({
    code: 'FORBIDDEN',
    message: 'Only hotel administrators can create rooms',
  })
}
```

### File: `convex/bookings.ts`

**Update `listByHotel` query:**

```typescript
// Add hotel access check (allows room_admin, hotel_admin, and hotel_cashier)
await requireHotelAccess(ctx, args.clerkUserId, args.hotelId)
```

**Similar updates needed for:**

- `convex/hotels.ts` - Update, delete operations
- `convex/rooms.ts` - Update, delete operations
- `convex/bookings.ts` - All admin operations

---

## PHASE 5: FRONTEND - NEW USER MANAGEMENT PAGE

### File: `src/routes/admin/users/index.tsx`

**Purpose:** Display all users with their hotel assignments and allow assigning/unassigning

**Key Features:**

- Table showing: Email | Global Role | Hotel Assignment | Hotel Role | Actions
- Search/filter by email
- "Assign" button → opens `AssignModal`
- "Unassign" button with confirmation (if assigned)

**Component Structure:**

```typescript
function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<Id<'users'> | null>(null)

  const users = useQuery(api.hotelStaff.listAllUsers, { clerkUserId: user.id })

  // Filter users by search query
  const filteredUsers = users?.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Handlers for assign/unassign
  const handleAssign = (userId) => { ... }
  const handleUnassign = async (userId) => { ... }
}
```

**UI Components:**

1. Header with title and description
2. Search bar with icon
3. Table with columns:
   - Email (text)
   - Global Role (badge: amber for room_admin, gray for customer)
   - Hotel Assignment (hotel name + city, or "Not assigned")
   - Hotel Role (badge: blue for hotel_admin, green for hotel_cashier)
   - Actions (Assign button or Unassign button)
4. Assign modal (conditional render)

**Styling:**

- Dark theme matching existing admin pages
- Hover effects on table rows
- Badge colors:
  - `room_admin`: Amber
  - `customer`: Gray
  - `hotel_admin`: Blue
  - `hotel_cashier`: Emerald

---

## PHASE 6: FRONTEND - ASSIGN MODAL COMPONENT

### File: `src/routes/admin/users/components/-AssignModal.tsx`

**Purpose:** Modal to assign user to a hotel with a specific role

**Props:**

- `userId: Id<'users'>` - User to assign
- `onClose: () => void` - Callback to close modal

**Key Features:**

- Dropdown to select hotel (showing name, city, country)
- Radio buttons for role selection (hotel_admin vs hotel_cashier)
- Validation: require hotel selection before submit
- Error handling and display
- Loading state during mutation

**Form Fields:**

1. **Hotel Dropdown:**
   - Lists all hotels from `api.hotels.list`
   - Shows: "Hotel Name - City, Country"
   - Required field

2. **Role Selection (Radio buttons):**
   - **Hotel Administrator:**
     - Description: "Can manage rooms, bookings, and hotel settings"
     - Value: `hotel_admin`
   - **Cashier:**
     - Description: "Can view bookings, check-in/out guests, and process refunds"
     - Value: `hotel_cashier`

**Actions:**

- "Cancel" button (gray)
- "Assign User" button (amber gradient, disabled if no hotel selected)

**Styling:**

- Modal overlay with backdrop blur
- Centered modal with max-width
- Header with title and close button
- Error banner (red) if assignment fails
- Form with proper spacing and labels

---

## PHASE 7: FRONTEND - UPDATE ADMIN LAYOUT

### File: `src/routes/admin.tsx`

**Changes needed:**

### 1. Add Users Navigation Item

```typescript
const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/hotels', label: 'Hotels', icon: Hotel },
  { to: '/admin/rooms', label: 'Rooms', icon: Building2 },
  { to: '/admin/bookings', label: 'Bookings', icon: Calendar },
  { to: '/admin/users', label: 'Users', icon: Users }, // NEW
]
```

### 2. Query Hotel Assignment

```typescript
const hotelAssignment = useQuery(
  api.hotelStaff.getByUserId,
  profile?._id ? { userId: profile._id } : 'skip',
)
```

### 3. Filter Navigation Items by Role

```typescript
const visibleNavItems = navItems.filter((item) => {
  // room_admin sees everything
  if (profile?.role === 'room_admin') return true

  // Cashiers only see Dashboard and Bookings
  if (hotelAssignment?.role === 'hotel_cashier') {
    return item.to === '/admin' || item.to === '/admin/bookings'
  }

  // hotel_admin sees everything except Users
  if (hotelAssignment?.role === 'hotel_admin') {
    return item.to !== '/admin/users'
  }

  return false
})
```

### 4. Use Filtered Nav Items

Replace `navItems.map(...)` with `visibleNavItems.map(...)` in both:

- Mobile slide-out menu
- Desktop sidebar

---

## PHASE 8: FRONTEND - UPDATE DASHBOARD

### File: `src/routes/admin/index.tsx`

**Changes needed:**

### 1. Query Hotel Assignment and Assigned Hotel

```typescript
const hotelAssignment = useQuery(
  api.hotelStaff.getByUserId,
  profile?._id ? { userId: profile._id } : 'skip',
)

const assignedHotel = useQuery(
  api.hotels.get,
  hotelAssignment?.hotelId ? { hotelId: hotelAssignment.hotelId } : 'skip',
)
```

### 2. Add Hotel Assignment Banner

Insert before stats grid:

```tsx
{
  /* Hotel Assignment Banner */
}
{
  hotelAssignment && assignedHotel && (
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 mb-8">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-blue-400 mb-1">Hotel Assignment</h3>
          <p className="text-slate-300 text-sm">
            You are assigned to{' '}
            <span className="font-medium text-white">{assignedHotel.name}</span>{' '}
            in {assignedHotel.city} as{' '}
            <span className="text-blue-400 font-medium uppercase text-xs tracking-wider">
              {hotelAssignment.role.replace('hotel_', '')}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
```

### 3. Filter Stats and Quick Actions (Future Enhancement)

For hotel_admin and hotel_cashier, filter stats and quick actions to show only data relevant to their assigned hotel.

---

## PHASE 9: FRONTEND - UPDATE OTHER ADMIN PAGES

### File: `src/routes/admin/hotels/index.tsx`

**Filter hotels by assignment:**

```typescript
const hotelAssignment = useQuery(
  api.hotelStaff.getByUserId,
  profile?._id ? { userId: profile._id } : 'skip',
)

// Filter hotels based on assignment
const visibleHotels =
  profile?.role === 'room_admin'
    ? hotels
    : hotels?.filter((h) => h._id === hotelAssignment?.hotelId)

// Hide "Add Hotel" button for non-room_admin
const canAddHotel = profile?.role === 'room_admin'
```

### File: `src/routes/admin/rooms/index.tsx`

**Filter rooms by hotel assignment:**

Similar filtering logic - only show rooms from assigned hotel for hotel_admin/cashier.

### File: `src/routes/admin/bookings/index.tsx`

**Filter bookings by hotel assignment:**

Similar filtering logic - only show bookings from assigned hotel for hotel_admin/cashier.

---

## ACCESS CONTROL MATRIX

| Feature         | room_admin | hotel_admin    | hotel_cashier  | customer |
| --------------- | ---------- | -------------- | -------------- | -------- |
| Access /admin   | ✅         | ✅             | ✅             | ❌       |
| See all hotels  | ✅         | ❌ (own only)  | ❌ (own only)  | ❌       |
| Add hotel       | ✅         | ❌             | ❌             | ❌       |
| Edit hotel      | ✅         | ✅ (own only)  | ❌             | ❌       |
| Add room        | ✅         | ✅ (own hotel) | ❌             | ❌       |
| Edit room       | ✅         | ✅ (own hotel) | ❌             | ❌       |
| View bookings   | ✅         | ✅ (own hotel) | ✅ (own hotel) | ❌       |
| Check-in guest  | ✅         | ✅             | ✅             | ❌       |
| Check-out guest | ✅         | ✅             | ✅             | ❌       |
| Process refund  | ✅         | ✅             | ✅             | ❌       |
| Cancel booking  | ✅         | ✅             | ❌             | ❌       |
| Manage users    | ✅         | ❌             | ❌             | ❌       |
| Assign users    | ✅         | ❌             | ❌             | ❌       |

---

## NAVIGATION VISIBILITY MATRIX

| Nav Item  | room_admin | hotel_admin | hotel_cashier |
| --------- | ---------- | ----------- | ------------- |
| Dashboard | ✅         | ✅          | ✅            |
| Hotels    | ✅         | ✅          | ❌            |
| Rooms     | ✅         | ✅          | ❌            |
| Bookings  | ✅         | ✅          | ✅            |
| Users     | ✅         | ❌          | ❌            |

---

## LOGIN FLOW

### How Login Works After Implementation:

```
1. User logs in via Clerk
   ↓
2. Clerk webhook creates user in Convex (global role: customer or room_admin)
   ↓
3. User navigates to /admin
   ↓
4. AdminLayout checks:
   - If role === 'room_admin' → ALLOW (full access)
   - If role === 'customer' → Check hotelStaff table
     - If has assignment → ALLOW (filtered access)
     - If no assignment → DENY (show "Access Denied")
   ↓
5. Dashboard loads:
   - If room_admin → Show all hotels, all stats
   - If has hotel assignment → Show assignment banner + filtered data
   ↓
6. Navigation items filtered:
   - room_admin → See all nav items (Dashboard, Hotels, Rooms, Bookings, Users)
   - hotel_admin → See Dashboard, Hotels, Rooms, Bookings (no Users)
   - hotel_cashier → See Dashboard, Bookings only
```

---

## SUMMARY: FILES TO CREATE/MODIFY

### Backend (Convex):

| File                   | Action     | Description                                  |
| ---------------------- | ---------- | -------------------------------------------- |
| `convex/schema.ts`     | **MODIFY** | Add `hotelStaff` table definition            |
| `convex/hotelStaff.ts` | **CREATE** | All queries/mutations for user assignments   |
| `convex/lib/auth.ts`   | **MODIFY** | Add hotel access helper functions            |
| `convex/rooms.ts`      | **MODIFY** | Add hotel access checks to mutations         |
| `convex/bookings.ts`   | **MODIFY** | Add hotel access checks to queries/mutations |
| `convex/hotels.ts`     | **MODIFY** | Add hotel access checks to mutations         |

### Frontend (React):

| File                                                 | Action     | Description                             |
| ---------------------------------------------------- | ---------- | --------------------------------------- |
| `src/routes/admin/users/index.tsx`                   | **CREATE** | User management page with table         |
| `src/routes/admin/users/components/-AssignModal.tsx` | **CREATE** | Modal for assigning users to hotels     |
| `src/routes/admin.tsx`                               | **MODIFY** | Add Users nav, filter nav items by role |
| `src/routes/admin/index.tsx`                         | **MODIFY** | Show hotel assignment banner            |
| `src/routes/admin/hotels/index.tsx`                  | **MODIFY** | Filter hotels by assignment             |
| `src/routes/admin/rooms/index.tsx`                   | **MODIFY** | Filter rooms by hotel assignment        |
| `src/routes/admin/bookings/index.tsx`                | **MODIFY** | Filter bookings by hotel assignment     |

---

## TESTING CHECKLIST

After implementation:

### Database Schema

- [ ] `hotelStaff` table exists in Convex
- [ ] Indexes created correctly (by_user, by_hotel)
- [ ] Can insert test assignment manually

### Backend Functions

- [ ] `hotelStaff.listAllUsers` returns all users with assignments
- [ ] `hotelStaff.assign` creates assignment successfully
- [ ] `hotelStaff.assign` throws error if user already assigned
- [ ] `hotelStaff.unassign` removes assignment successfully
- [ ] Auth helpers work correctly (canAccessHotel, requireHotelAccess)

### Frontend - User Management

- [ ] `/admin/users` page loads for room_admin
- [ ] User table displays all users
- [ ] Search by email works
- [ ] "Assign" button opens modal
- [ ] Modal allows selecting hotel and role
- [ ] Assignment succeeds and table updates
- [ ] "Unassign" button removes assignment

### Frontend - Navigation

- [ ] room_admin sees all nav items (Dashboard, Hotels, Rooms, Bookings, Users)
- [ ] hotel_admin sees Dashboard, Hotels, Rooms, Bookings (no Users)
- [ ] hotel_cashier sees Dashboard, Bookings only
- [ ] Mobile hamburger menu respects same filtering

### Frontend - Dashboard

- [ ] Assigned users see assignment banner
- [ ] room_admin doesn't see assignment banner (even if assigned)
- [ ] Banner shows correct hotel name and role

### Frontend - Data Filtering

- [ ] hotel_admin sees only their assigned hotel in Hotels page
- [ ] hotel_cashier sees only their assigned hotel's bookings
- [ ] room_admin still sees all data (not filtered)

### Permissions

- [ ] hotel_admin can edit their assigned hotel
- [ ] hotel_admin cannot edit other hotels
- [ ] hotel_cashier cannot edit hotels
- [ ] hotel_cashier can view bookings for their hotel
- [ ] hotel_cashier cannot access Hotels or Rooms pages

---

## FUTURE ENHANCEMENTS

Potential improvements for later:

1. **Multiple Hotel Assignments:**
   - Allow users to be assigned to multiple hotels with different roles
   - Add hotel switcher in navbar

2. **Email Notifications:**
   - Send email when user is assigned/unassigned
   - Use Resend or SendGrid integration

3. **Assignment History:**
   - Track when users were assigned/unassigned
   - Show history in audit log

4. **Role Permissions Editor:**
   - Admin UI to customize what each role can do
   - Store permissions in database

5. **Batch Assignment:**
   - Assign multiple users at once
   - Import assignments from CSV

6. **Hotel-Specific Settings:**
   - Each hotel can have custom policies
   - Settings managed by hotel_admin

7. **Cashier Features:**
   - Check-in/out interface
   - Payment processing
   - Receipt printing

8. **Reports:**
   - Hotel performance reports
   - Cashier activity logs
   - Booking analytics

---

## WALKTHROUGH: SUCCESSFUL SIGNUP AND ASSIGNMENT

### Scenario 1: Assigning a User as Hotel Admin

**Step 1: User Creates Account**

1. Sarah visits the hotel management website
2. She clicks "Sign Up" and creates an account with email: sarah@example.com
3. Clerk creates her account and the webhook automatically creates her in Convex with role: `customer`
4. Sarah can now browse hotels and make bookings as a regular customer

**Step 2: Super Admin Assigns Sarah as Hotel Admin**

1. John (super admin with `room_admin` role) logs into the admin dashboard at `/admin`
2. John sees all navigation items: Dashboard, Hotels, Rooms, Bookings, Users
3. John clicks on "Users" in the sidebar
4. The Users page loads, showing a table with all users including Sarah:
   - Email: sarah@example.com
   - Global Role: customer (gray badge)
   - Hotel Assignment: "Not assigned" (in italics)
   - Actions: "Assign" button (amber color)

5. John clicks the "Assign" button next to Sarah's name
6. A modal opens titled "Assign User to Hotel"
7. The modal shows:
   - A dropdown labeled "Select Hotel" with all hotels listed
   - Two radio buttons for role selection:
     - ✓ Hotel Administrator (selected by default)
       - Description: "Can manage rooms, bookings, and hotel settings"
     - ○ Cashier
       - Description: "Can view bookings, check-in/out guests, and process refunds"

8. John selects "Grand Plaza Hotel - New York, USA" from the dropdown
9. He leaves "Hotel Administrator" selected
10. John clicks the "Assign User" button
11. The modal shows "Assigning..." briefly
12. The mutation succeeds, the modal closes, and the table updates:
    - Email: sarah@example.com
    - Global Role: customer (gray badge)
    - Hotel Assignment: "Grand Plaza Hotel, New York" (with building icon)
    - Hotel Role: hotel_admin (blue badge)
    - Actions: "Unassign" button (red color)

**Step 3: Sarah Logs In as Hotel Admin**

1. Sarah logs out and logs back in
2. She navigates to `/admin`
3. The AdminLayout component checks her permissions:
   - Her global role is still `customer`
   - But she has a hotel assignment in the `hotelStaff` table
   - She is granted access to the admin dashboard

4. The dashboard loads with:
   - A blue banner at the top showing:
     - Icon: Building
     - Title: "Hotel Assignment"
     - Message: "You are assigned to **Grand Plaza Hotel** in New York as **ADMIN**"
5. Sarah sees the following navigation items in the sidebar:
   - ✓ Dashboard
   - ✓ Hotels
   - ✓ Rooms
   - ✓ Bookings
   - ✗ Users (hidden - only room_admin can see this)

6. Sarah clicks on "Hotels"
7. The Hotels page loads, but she only sees:
   - Grand Plaza Hotel (her assigned hotel)
   - She doesn't see the other 20 hotels in the system
   - The "Add Hotel" button is hidden (only room_admin can add hotels)

8. Sarah clicks on her hotel and manages the rooms:
   - She can add new rooms
   - She can edit existing rooms
   - She can change room prices and availability

9. Sarah clicks on "Bookings"
10. She only sees bookings for Grand Plaza Hotel
11. She can check guests in/out and process refunds

**What Sarah CANNOT Do:**

- ✗ Cannot assign other users (no access to Users page)
- ✗ Cannot add new hotels to the system
- ✗ Cannot edit or view other hotels
- ✗ Cannot see bookings from other hotels

---

### Scenario 2: Assigning a User as Hotel Cashier

**Step 1: User Creates Account**

1. Mike visits the hotel management website
2. He signs up with email: mike@example.com
3. Clerk creates his account with role: `customer`
4. Mike can browse and book hotels normally

**Step 2: Super Admin Assigns Mike as Cashier**

1. John (super admin) logs into `/admin`
2. John navigates to "Users"
3. He finds Mike in the user table:
   - Email: mike@example.com
   - Global Role: customer
   - Hotel Assignment: Not assigned
4. John clicks "Assign" next to Mike's name
5. The assignment modal opens
6. John selects:
   - Hotel: "Sunset Resort - Miami, USA"
   - Role: Cashier (selects the second radio button)
     - Description: "Can view bookings, check-in/out guests, and process refunds"

7. John clicks "Assign User"
8. The assignment succeeds and Mike is now:
   - Email: mike@example.com
   - Global Role: customer
   - Hotel Assignment: Sunset Resort, Miami
   - Hotel Role: hotel_cashier (green badge)

**Step 3: Mike Logs In as Cashier**

1. Mike logs in and navigates to `/admin`
2. Access is granted based on his hotel assignment
3. The dashboard loads with:
   - Blue assignment banner showing:
     - "You are assigned to **Sunset Resort** in Miami as **CASHIER**"

4. Mike sees **only 2 navigation items**:
   - ✓ Dashboard
   - ✓ Bookings
   - ✗ Hotels (hidden)
   - ✗ Rooms (hidden)
   - ✗ Users (hidden)

5. Mike clicks on "Bookings"
6. He sees only bookings for Sunset Resort
7. On each booking, he can:
   - View guest details
   - Check guests in (change status from "confirmed" to "checked_in")
   - Check guests out (change status from "checked_in" to "checked_out")
   - Process refunds (if needed)

**What Mike CANNOT Do:**

- ✗ Cannot view or access the Hotels page
- ✗ Cannot view or access the Rooms page
- ✗ Cannot add, edit, or delete hotels
- ✗ Cannot add, edit, or delete rooms
- ✗ Cannot cancel bookings (only hotel_admin can do this)
- ✗ Cannot assign other users
- ✗ Cannot see bookings from other hotels

**Mike's Daily Workflow:**

1. Arrives at work at the Sunset Resort front desk
2. Logs into `/admin`
3. Clicks "Bookings"
4. Sees all today's check-ins and check-outs
5. When a guest arrives:
   - Finds their booking
   - Clicks "Check In"
   - Guest receives room key
6. When a guest leaves:
   - Finds their booking
   - Clicks "Check Out"
   - Processes payment if needed
   - Issues refund if there were issues

---

### Scenario 3: Super Admin Remains Unrestricted

**John's Experience (room_admin with assignment):**

1. John decides to assign himself to Grand Plaza Hotel as hotel_admin
2. Another super admin assigns John to the hotel
3. John logs in and sees:
   - The assignment banner (informational only)
   - **All navigation items** (Dashboard, Hotels, Rooms, Bookings, Users)
   - **All hotels** in the Hotels page (not filtered)
   - **All bookings** in the Bookings page (not filtered)

4. John can still:
   - ✓ Add new hotels
   - ✓ Edit any hotel
   - ✓ Manage any rooms across all hotels
   - ✓ View and manage all bookings
   - ✓ Assign/unassign users

**Why?** The `room_admin` global role always grants full access, regardless of hotel assignment. The assignment is just informational for room_admins.

---

### Scenario 4: Unassigning a User

**Step 1: User Loses Assignment**

1. John (super admin) decides Sarah is no longer managing Grand Plaza Hotel
2. John goes to `/admin/users`
3. He finds Sarah's row:
   - Email: sarah@example.com
   - Global Role: customer
   - Hotel Assignment: Grand Plaza Hotel, New York
   - Hotel Role: hotel_admin

4. John clicks the "Unassign" button
5. A confirmation dialog appears: "Are you sure you want to unassign this user?"
6. John clicks "Yes"
7. The mutation runs and Sarah's assignment is deleted
8. The table updates:
   - Email: sarah@example.com
   - Global Role: customer
   - Hotel Assignment: Not assigned
   - Actions: "Assign" button

**Step 2: Sarah Loses Access**

1. Sarah is currently logged into `/admin` managing rooms
2. She clicks "Dashboard" to navigate
3. The page reloads and checks her permissions
4. She no longer has a hotel assignment
5. The AdminLayout component denies access:
   - Shows "Access Denied" screen
   - Message: "You don't have permission to access the admin area. This section is restricted to room administrators only."
   - Button: "Return Home"

6. Sarah clicks "Return Home" and is redirected to `/`
7. She can still use the site as a regular customer to book hotels

---

## EDGE CASES HANDLED

### 1. Trying to Assign Already-Assigned User

- **Action:** Admin tries to assign Sarah who is already assigned to Hotel A
- **Result:** Error message: "User is already assigned to a hotel. Unassign first."
- **Solution:** Admin must unassign Sarah first, then reassign to Hotel B

### 2. Deleted Hotel

- **Action:** Admin tries to assign user to a hotel that was soft-deleted
- **Result:** Error message: "Hotel not found"
- **Prevention:** Assignment modal doesn't show deleted hotels

### 3. User Deleted After Assignment

- **Action:** User is deleted from Clerk/database but assignment remains
- **Result:** Assignment table shows "Unknown" for user email
- **Best Practice:** Implement cascade delete or cleanup script

### 4. Multiple Admins Assigning Simultaneously

- **Action:** Two admins try to assign same user at same time
- **Result:** First one succeeds, second gets "already assigned" error
- **Convex handles:** Automatic transaction isolation

### 5. Room Admin Assigned to Hotel

- **Action:** Super admin assigns another room_admin to a hotel
- **Result:** Assignment created, but assignee still has full access
- **Expected:** Assignment is informational only for room_admins

---

This completes the implementation plan for the User & Hotel Staff Management feature.
