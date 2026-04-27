# Image Storage — Implementation Plan

## 1) Overview

This document captures the full plan for adding image upload and display support to the Hotel Management System using Convex File Storage. It covers user stories, technical decisions, schema changes, backend mutations/queries, and frontend component changes.

The feature affects two entities:

- **Hotels** — a cover image uploaded by `hotel_admin` or `room_admin` when creating or editing a hotel.
- **Rooms** — a room image uploaded by `hotel_cashier` or any staff with hotel access when creating or editing a room.

Because 50+ hotels and rooms already exist with no images, **all new image fields are optional** for full backward compatibility. Existing records will continue to display placeholder UI.

---

## 2) User Stories

### 2.1 Hotel Admin / Room Admin — Hotel Image

> **US-01** — As a `hotel_admin` or `room_admin`, when I create a new hotel, I want to upload a cover image so that customers can visually identify the property.

**Acceptance criteria:**

- The "Add New Hotel" modal contains an image upload section.
- I can select any image file (JPEG, PNG, WebP, etc.) up to 10 MB.
- A local preview is shown immediately after selecting the file.
- If I select an invalid file type or a file over 10 MB, a clear error message is shown and the file is not uploaded.
- When I submit the form, the image is associated with the new hotel.
- The field is optional — I can save the hotel without an image.

---

> **US-02** — As a `hotel_admin` or `room_admin`, when I edit an existing hotel (via either the full hotel modal or the simplified hotel edit modal on the hotel detail page), I want to update the hotel's cover image so that the displayed photo stays accurate.

**Acceptance criteria:**

- If the hotel already has an image, it is shown as the current preview in the modal.
- I can upload a new image to replace the existing one.
- When the form is saved with a new image, the old image is deleted from Convex storage to prevent orphaned files.
- I can also save the form without changing the image (existing image is preserved).

---

### 2.2 Hotel Cashier / Hotel Staff — Room Image

> **US-03** — As a `hotel_cashier` or staff member with hotel access, when I add a new room, I want to upload a room image so that customers can see what the room looks like before booking.

**Acceptance criteria:**

- The "Add New Room" modal contains an image upload section.
- I can select any image file up to 10 MB.
- A local preview is shown immediately after selecting the file.
- The field is optional — I can save the room without an image.

---

> **US-04** — As a `hotel_cashier` or staff member with hotel access, when I edit an existing room, I want to replace the room image.

**Acceptance criteria:**

- If the room already has an image, it is shown as the current preview in the modal.
- I can upload a new image; the old one is deleted from storage on save.
- I can save without changing the image (existing image is preserved).

---

### 2.3 Customer — Viewing Images

> **US-05** — As a customer browsing hotels on the `/select-location` page, I want to see a real photo of the hotel in each card so that I can make a more informed choice.

**Acceptance criteria:**

- Hotel cards that have an uploaded image display that image in the card's image area.
- Hotels without an image continue to show the existing gradient + `Building2` icon placeholder.
- Images are displayed at consistent aspect ratio (the existing `h-48` card image slot).

---

> **US-06** — As a customer viewing a hotel's detail page (`/hotels/:hotelId`), I want to see the available rooms with their photos so that I can choose the right room.

**Acceptance criteria:**

- Room cards that have an uploaded image display that image.
- Room cards without an image show a placeholder.

---

## 3) Key Decisions

| #    | Decision                              | Choice                                                                               | Rationale                                                                               |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| D-01 | Where to store the image reference    | `imageStorageId` directly on `hotels` / `rooms` tables                               | Simple, no extra join, one image per entity is sufficient                               |
| D-02 | How to expose the URL to the frontend | Inline `imageUrl` resolution in existing query return types                          | All existing consumers automatically receive the URL without component-level changes    |
| D-03 | Upload timing                         | Upload on file select (before form submit)                                           | Immediate preview feedback; `storageId` ready when user clicks Save                     |
| D-04 | Old image on replace                  | Delete old `storageId` from storage in the `update` mutation                         | Keeps storage clean; prevents accumulation of orphaned blobs                            |
| D-05 | Both hotel modals                     | Both `HotelModal` (create/edit) and `HotelEditModal` (simplified edit) support image | Admin should be able to update the image from either editing surface                    |
| D-06 | Room image on customer side           | Show room image in room cards on hotel detail page                                   | Customers benefit from seeing the room before booking                                   |
| D-07 | `generateUploadUrl` auth              | `requireUser` — any authenticated user                                               | Upload URL is short-lived and scoped; actual DB save is already role-gated on mutations |
| D-08 | File constraints                      | Any `image/*` type, max 10 MB                                                        | Standard and permissive; validated client-side before upload                            |

---

## 4) Schema Changes

**File:** `convex/schema.ts`

Add one optional field to the `hotels` table:

```typescript
hotels: defineTable({
  // ... existing fields ...
  imageStorageId: v.optional(v.id('_storage')), // NEW
  isDeleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

Add one optional field to the `rooms` table:

```typescript
rooms: defineTable({
  // ... existing fields ...
  imageStorageId: v.optional(v.id('_storage')), // NEW
  isDeleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

No new indexes are required. No existing indexes are affected. All existing documents remain valid because the field is optional.

---

## 5) Backend Changes

### 5.1 New file — `convex/files.ts`

```typescript
export const generateUploadUrl = mutation({
  args: { clerkUserId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireUser(ctx, args.clerkUserId)
    return await ctx.storage.generateUploadUrl()
  },
})
```

Single mutation gated to any authenticated user. The actual image association with a hotel/room record is protected by the existing role gates on `hotels.create`, `hotels.update`, `rooms.create`, and `rooms.update`.

---

### 5.2 `convex/hotels.ts`

**`hotelValidator`** — add two new optional fields:

```typescript
imageStorageId: v.optional(v.id('_storage')),
imageUrl: v.optional(v.string()),
```

**All query handlers** (`list`, `get`, `search`, `getByCity`, `listForOutsource`) — after fetching hotel(s) from DB, resolve `imageUrl`:

```typescript
const imageUrl = hotel.imageStorageId
  ? await ctx.storage.getUrl(hotel.imageStorageId)
  : undefined

return { ...hotel, imageUrl: imageUrl ?? undefined }
```

For queries returning arrays, map over results and resolve URLs in parallel using `Promise.all`.

**`create` mutation** — add `imageStorageId: v.optional(v.id('_storage'))` to args; pass through to `ctx.db.insert`.

**`update` mutation** — add `imageStorageId: v.optional(v.id('_storage'))` to args. Before patching, if the incoming `imageStorageId` differs from the existing one and the hotel has an old `imageStorageId`, call `ctx.storage.delete(hotel.imageStorageId)`. Then apply the new value via `trackChange`.

---

### 5.3 `convex/rooms.ts`

Same treatment as `hotels.ts`:

- Add `imageStorageId` and `imageUrl` to `roomValidator`
- Inline URL resolution in `getByHotel`, `getByHotelWithLiveState`, `get`, `getAvailableRooms`
- Accept `imageStorageId` in `create` and `update` args
- Delete old storage object in `update` when image is replaced

---

## 6) Frontend Changes

### 6.1 Shared image upload pattern (used in all three modals)

Each modal will follow this pattern:

```
State:
  imageStorageId: string | null  — the storageId from Convex after upload
  imagePreview: string | null    — local object URL / data URL for preview
  imageUploading: boolean        — upload in progress flag
  imageError: string             — validation / upload error message

On file input change:
  1. Validate file.type starts with "image/" → show error if not
  2. Validate file.size <= 10 * 1024 * 1024 → show error if not
  3. Set imagePreview via FileReader.readAsDataURL
  4. Set imageUploading = true
  5. Call generateUploadUrl({ clerkUserId })
  6. POST file to the returned URL with Content-Type header
  7. Parse { storageId } from response JSON
  8. Set imageStorageId = storageId
  9. Set imageUploading = false

On form submit:
  Include imageStorageId in the create/update payload
  (undefined if no new image was selected — server preserves existing)

UI elements:
  - Hidden <input type="file" accept="image/*" ref={inputRef} />
  - Clickable upload area (shows preview if imagePreview exists, otherwise placeholder)
  - "Change image" button overlay when preview is shown
  - Spinner overlay during imageUploading
  - Error text below the upload area
  - "Optional" label so admins know the field is not required
```

---

### 6.2 `src/routes/admin/hotels/index/components/-HotelModal.tsx`

- Add image upload section above the Hotel Name field (visually prominent, first thing in the form)
- When editing (`hotelId` is set): initialize `imagePreview` from `hotel.imageUrl` if it exists
- Pass `imageStorageId` to `createHotel` / `updateHotel` payload

---

### 6.3 `src/routes/admin/hotels/$hotelId/components/-HotelEditModal.tsx`

- Add the same image upload section
- Fetch the hotel's existing `imageUrl` and pre-populate the preview
- Pass `imageStorageId` in the update payload

---

### 6.4 `src/routes/admin/hotels/$hotelId/components/-RoomModal.tsx`

- Add image upload section above the Room Number field
- When editing: initialize preview from `room.imageUrl`
- Pass `imageStorageId` to `createRoom` / `updateRoom` payload

---

### 6.5 `src/routes/select-location/components/-HotelGrid.tsx`

The hotel card's image area (currently `h-48` gradient + `Building2` icon) becomes conditional:

```tsx
<div className="h-48 bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
  {hotel.imageUrl ? (
    <img
      src={hotel.imageUrl}
      alt={hotel.name}
      className="absolute inset-0 w-full h-full object-cover"
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center">
      <Building2 className="w-16 h-16 text-slate-700" />
    </div>
  )}
  {/* overlay gradient, badges, distance — unchanged */}
</div>
```

The `HotelGridProps` interface gains `imageUrl?: string | undefined` on the hotel shape. The parent (`select-location.tsx`) will pass through `imageUrl` from the Convex query result, which now includes it.

---

### 6.6 `src/routes/hotels.$hotelId.tsx` (hotel detail page — room cards)

Room cards in the hotel detail page get a thumbnail image area:

```tsx
<div className="h-32 bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden rounded-t-xl">
  {room.imageUrl ? (
    <img
      src={room.imageUrl}
      alt={`Room ${room.roomNumber}`}
      className="absolute inset-0 w-full h-full object-cover"
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center">
      <BedDouble className="w-10 h-10 text-slate-700" />
    </div>
  )}
</div>
```

---

## 7) Files Affected — Summary

| File                                                              | Type     | Change                                                                           |
| ----------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `convex/schema.ts`                                                | Modified | Add `imageStorageId` to `hotels` and `rooms` tables                              |
| `convex/files.ts`                                                 | **New**  | `generateUploadUrl` mutation                                                     |
| `convex/hotels.ts`                                                | Modified | `imageStorageId` + `imageUrl` in validator, args, query handlers, update cleanup |
| `convex/rooms.ts`                                                 | Modified | Same as hotels.ts                                                                |
| `src/routes/admin/hotels/index/components/-HotelModal.tsx`        | Modified | Image upload UI + state + payload                                                |
| `src/routes/admin/hotels/$hotelId/components/-HotelEditModal.tsx` | Modified | Image upload UI + state + payload                                                |
| `src/routes/admin/hotels/$hotelId/components/-RoomModal.tsx`      | Modified | Image upload UI + state + payload                                                |
| `src/routes/select-location/components/-HotelGrid.tsx`            | Modified | Conditional image vs placeholder in hotel cards                                  |
| `src/routes/hotels.$hotelId.tsx`                                  | Modified | Room card image thumbnail area                                                   |

---

## 8) Backward Compatibility

- All new schema fields are `v.optional(...)` — existing hotel and room documents remain valid with no migration needed.
- All query return validators include the new fields as `v.optional(v.string())` — existing consumers that destructure hotel/room objects are unaffected.
- Hotels/rooms without images continue to display existing placeholder UI unchanged.
- No seed data changes required.

---

## 9) Out of Scope

- Image CDN / resizing / optimization (Convex serves raw uploaded files)
- Multiple images per hotel or room (one image per entity)
- Customer-facing hotel detail page hero image (decided against during planning)
- Admin-only bulk image import / seeding for existing 50 hotels
- Image moderation or virus scanning

---

## 10) Implementation Order

1. `convex/schema.ts` — add fields (triggers Convex schema sync)
2. `convex/files.ts` — add `generateUploadUrl`
3. `convex/hotels.ts` — update validator, queries, mutations
4. `convex/rooms.ts` — update validator, queries, mutations
5. `src/routes/admin/hotels/index/components/-HotelModal.tsx`
6. `src/routes/admin/hotels/$hotelId/components/-HotelEditModal.tsx`
7. `src/routes/admin/hotels/$hotelId/components/-RoomModal.tsx`
8. `src/routes/select-location/components/-HotelGrid.tsx`
9. `src/routes/hotels.$hotelId.tsx`
