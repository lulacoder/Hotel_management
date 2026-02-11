# Rating System Documentation

This document explains the dual-layer rating system used in the Hotel Management application, how ratings are calculated and displayed to users, and how administrators can manage them.

## Overview

The application uses a hybrid approach for hotel ratings:
1.  **Static/Imported Rating**: A fixed rating value that comes from the initial data import.
2.  **User-Submitted Ratings**: Dynamic ratings submitted by authenticated users.

This ensures that hotels display a quality indicator (from imported data) even before any users have rated them, while progressively transitioning to real community feedback as users interact with the app.

## Data Model

### 1. Static Rating (`hotels` table)
Every hotel record has an optional `rating` field (1.0 - 5.0).
-   **Source**: Imported from external JSON data.
-   **Nature**: Static. It does not change automatically.
-   **Purpose**: Acts as a fallback value when no user ratings exist.

```typescript
// convex/schema.ts
hotels: defineTable({
  // ...
  rating: v.optional(v.number()), // 1.0-5.0 (Static)
  // ...
})
```

### 2. User Ratings (`hotelRatings` table)
When a user rates a hotel, a record is created in the `hotelRatings` table.
-   **Source**: User input via the UI.
-   **Nature**: Dynamic. One rating per user per hotel.
-   **Fields**:
    -   `hotelId`: The hotel being rated.
    -   `userId`: The user who submitted the rating.
    -   `rating`: Integer value (1-5).
    -   `review`: Optional text review.
    -   `isDeleted`: Soft-delete flag (admin moderation).

```typescript
// convex/schema.ts
hotelRatings: defineTable({
  hotelId: v.id('hotels'),
  userId: v.id('users'),
  rating: v.number(), // 1-5
  review: v.optional(v.string()),
  isDeleted: v.boolean(),
  // ...
})
```

## How Ratings are Calculated & Displayed

The application logic determines which rating to show on hotel cards and search results based on the presence of user feedback.

### The Algorithm (Public View)

1.  **Aggregation**: The backend query (`getSummaries`) groups all **non-deleted** user ratings by hotel.
2.  **Calculation**: It calculates the **average** of these user ratings.
3.  **Display Logic**:
    -   **IF** there is at least one valid user rating: Display the **average user rating**.
    -   **ELSE**: Display the **static imported rating** (`hotel.rating`).

### Why the "Same Rating" Reflects for All Users
The rating shown on the hotel card is a **global value** (either the static import or the global average). It is consistent for all users.
-   If no one has rated Hotel A, everyone sees the static "4.5" from the database.
-   If 10 users rate Hotel A and the average is "4.2", everyone sees "4.2".
-   The only "personal" rating number is inside the "Rate this Hotel" modal, which pre-fills with the specific user's previous selection.

## Admin Management

Administrators have full visibility and control over user-submitted ratings.

### Viewing User Ratings
Admins can view detailed rating information on the **Hotel Detail Page** in the Admin Dashboard (`/admin/hotels/$hotelId`).

1.  Navigate to the Admin Dashboard.
2.  Click on a specific hotel to view its details.
3.  Scroll down to the **"Ratings"** section.

**What Admins See:**
-   **Total Count**: Number of active ratings.
-   **Individual Entries**: List of all reviews.
-   **User Details**: Email address of the user who submitted the rating (unlike the public view which is anonymous).
-   **Review Content**: Star rating, date, and full review text.

### Soft Deleting Ratings
If a review is inappropriate or spam, admins can remove it from public view without permanently erasing the data record.

1.  In the **"Ratings"** section of the Hotel Detail Page.
2.  Locate the specific review.
3.  Click the **Delete (Trash Icon)** button next to the review.
4.  Confirm the action in the browser prompt.

**Technical Process:**
-   The `softDeleteRating` mutation is called.
-   The `isDeleted` flag on the `hotelRatings` record is set to `true`.
-   **Effect**: The rating is immediately excluded from the public average calculation and disappears from the public list.
-   **Audit**: An audit log entry (`rating_deleted`) is created in the `auditEvents` table to track this moderation action.
