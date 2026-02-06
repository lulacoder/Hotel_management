# Data Import & Geolocation Enhancement

This document covers the hotel data import system and geolocation-based features added to enhance the customer experience.

## Overview

This implementation phase added:

1. **Extended Schema** - New fields for hotels and rooms (description, category, tags, location, etc.)
2. **Data Import System** - Seed script to import hotels from JSON files
3. **Geolocation Features** - Distance calculation and location-based sorting

## Extended Schema

### Hotels Table - New Fields

```typescript
hotels: defineTable({
  // ... existing fields ...

  // New optional fields
  externalId: v.optional(v.string()), // Original ID from imported data
  description: v.optional(v.string()), // Hotel description
  category: v.optional(
    v.union(
      v.literal('Boutique'),
      v.literal('Budget'),
      v.literal('Luxury'),
      v.literal('Resort and Spa'),
      v.literal('Extended-Stay'),
      v.literal('Suite'),
    ),
  ),
  tags: v.optional(v.array(v.string())), // ["pool", "wifi", "gym", etc.]
  parkingIncluded: v.optional(v.boolean()), // Free parking available
  rating: v.optional(v.number()), // 1.0 - 5.0
  stateProvince: v.optional(v.string()), // "NY", "CA", etc.
  postalCode: v.optional(v.string()), // "10022"
  lastRenovationDate: v.optional(v.string()), // "YYYY-MM-DD" format
  location: v.optional(
    v.object({
      // Geo coordinates
      lat: v.number(),
      lng: v.number(),
    }),
  ),
})
  // New indexes
  .index('by_category', ['category'])
  .index('by_external_id', ['externalId'])
  .searchIndex('search_name', {
    searchField: 'name',
    filterFields: ['category', 'city', 'isDeleted'],
  })
```

### Rooms Table - New Fields

```typescript
rooms: defineTable({
  // ... existing fields ...

  // Type changed from single|double to budget|standard
  type: v.union(
    v.literal('budget'), // Was: single
    v.literal('standard'), // Was: double
    v.literal('suite'),
    v.literal('deluxe'),
  ),

  // New optional fields
  description: v.optional(v.string()), // "Budget Room, 1 Queen Bed (Cityside)"
  bedOptions: v.optional(v.string()), // "1 King Bed", "2 Queen Beds"
  smokingAllowed: v.optional(v.boolean()), // Smoking policy
})
  // New index
  .index('by_hotel_and_type', ['hotelId', 'type'])
```

### Why These Fields?

| Field             | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `externalId`      | Link back to source data, prevent duplicate imports |
| `description`     | Rich hotel/room descriptions for better UX          |
| `category`        | Filter hotels by type (Luxury, Budget, etc.)        |
| `tags`            | Flexible tagging for amenities and features         |
| `parkingIncluded` | Common filter criterion                             |
| `rating`          | Sort/filter by quality                              |
| `location`        | Enable distance-based features                      |
| `bedOptions`      | Important booking detail                            |
| `smokingAllowed`  | Common room preference                              |

## Data Import System

### Source Data Format

The import system reads from `Hotel_data/Hotel.json` with this structure:

```json
{
  "value": [
    {
      "HotelId": "1",
      "HotelName": "Stay-Kay City Hotel",
      "Description": "This classic hotel is fully-refurbished...",
      "Category": "Boutique",
      "Tags": ["view", "air conditioning", "concierge"],
      "ParkingIncluded": false,
      "LastRenovationDate": "2022-01-18T00:00:00Z",
      "Rating": 3.6,
      "Address": {
        "StreetAddress": "677 5th Ave",
        "City": "New York",
        "StateProvince": "NY",
        "PostalCode": "10022",
        "Country": "USA"
      },
      "Location": {
        "type": "Point",
        "coordinates": [-73.975403, 40.760586] // [lng, lat] GeoJSON format
      },
      "Rooms": [
        {
          "Description": "Budget Room, 1 Queen Bed (Cityside)",
          "Type": "Budget Room",
          "BaseRate": 96.99,
          "BedOptions": "1 Queen Bed",
          "SleepsCount": 2,
          "SmokingAllowed": true,
          "Tags": ["vcr/dvd"]
        }
      ]
    }
  ]
}
```

### Data Transformations

The seed script applies these transformations:

| Source                                       | Transformed To                          | Example               |
| -------------------------------------------- | --------------------------------------- | --------------------- |
| `BaseRate: 96.99`                            | `basePrice: 9699`                       | Dollars to cents      |
| `Location.coordinates: [-73.97, 40.76]`      | `location: { lat: 40.76, lng: -73.97 }` | GeoJSON to {lat, lng} |
| `Type: "Budget Room"`                        | `type: "budget"`                        | Normalized, lowercase |
| `LastRenovationDate: "2022-01-18T00:00:00Z"` | `lastRenovationDate: "2022-01-18"`      | ISO to date string    |
| No room numbers in source                    | `roomNumber: "101", "102", ...`         | Auto-generated        |

### Seed Script

**Location:** `scripts/seed-hotels.ts`

**Usage:**

```bash
# Generate Convex types first
npx convex dev --once

# Clear existing data and import fresh
npx tsx scripts/seed-hotels.ts --clear

# Import without clearing (will skip duplicates via externalId)
npx tsx scripts/seed-hotels.ts

# Only clear data (no import)
npx tsx scripts/seed-hotels.ts --clear-only
```

**What it does:**

1. Reads `Hotel_data/Hotel.json`
2. For each hotel, calls `api.seed.seedHotel` mutation
3. The mutation creates the hotel + all its rooms
4. Reports progress and summary

**Sample output:**

```
Connecting to Convex at: https://your-deployment.convex.cloud

🗑️  Clearing existing hotels and rooms...
   Deleted 50 hotels and 757 rooms

🏨 Starting Hotel Data Import...

📊 Found 50 hotels to import

✅ [1/50] Stay-Kay City Hotel - 13 rooms
✅ [2/50] Countryside Hotel - 12 rooms
...
✅ [50/50] Smile Up Hotel - 20 rooms

==================================================
📈 Import Summary:
   Hotels imported: 50/50
   Total rooms: 757
==================================================

🎉 All hotels imported successfully!
```

### Seed Mutations

**Location:** `convex/seed.ts`

#### `seed.seedHotel`

Creates a hotel and its rooms from JSON data.

```typescript
await client.mutation(api.seed.seedHotel, {
  hotel: {
    HotelId: '1',
    HotelName: 'Grand Hotel',
    // ... full hotel object from JSON
  },
})
```

**Returns:** `{ hotelId: Id<"hotels">, roomCount: number }`

#### `seed.clearAllHotelsAndRooms`

Deletes all hotels and rooms (hard delete for seeding purposes).

```typescript
await client.mutation(api.seed.clearAllHotelsAndRooms, {})
```

**Returns:** `{ hotelsDeleted: number, roomsDeleted: number }`

**Note:** These are public mutations for development. In production, you'd want to restrict access.

## Geolocation Features

### Distance Calculation

**Location:** `src/lib/distance.ts`

The Haversine formula calculates distance between two coordinates on Earth's surface.

```typescript
import { calculateDistance, formatDistance } from '@/lib/distance'

// Calculate distance in kilometers
const km = calculateDistance(
  userLat,
  userLng, // User's location
  hotelLat,
  hotelLng, // Hotel's location
)

// Format for display
formatDistance(2.5) // "2.5 km"
formatDistance(0.5) // "500 m"
```

**Available functions:**

| Function                                    | Description                 |
| ------------------------------------------- | --------------------------- |
| `calculateDistance(lat1, lng1, lat2, lng2)` | Returns distance in km      |
| `formatDistance(km)`                        | Formats as "X km" or "X m"  |
| `calculateDistanceMiles(...)`               | Returns distance in miles   |
| `formatDistanceMiles(miles)`                | Formats as "X mi" or "X ft" |

### Geolocation Hook

**Location:** `src/hooks/useGeolocation.ts`

React hook for browser geolocation API.

```typescript
import { useGeolocation } from '@/hooks/useGeolocation'

function MyComponent() {
  const {
    latitude,        // number | null
    longitude,       // number | null
    error,           // GeolocationPositionError | null
    loading,         // boolean
    supported,       // boolean
    requestLocation, // () => void
  } = useGeolocation()

  // Request location on mount
  useEffect(() => {
    requestLocation()
  }, [])

  if (loading) return <div>Getting your location...</div>
  if (error) return <div>{getGeolocationErrorMessage(error)}</div>
  if (latitude && longitude) {
    return <div>You are at {latitude}, {longitude}</div>
  }
}
```

**Error messages:**

```typescript
import { getGeolocationErrorMessage } from '@/hooks/useGeolocation'

// Returns user-friendly messages:
// - "Location permission denied. Please enable in browser settings."
// - "Unable to determine your location. Please try again."
// - "Location request timed out. Please try again."
```

## Enhanced Customer Flow

### Select Location Page

**Route:** `/select-location`

The hotel listing page now includes:

1. **Location Request** - Asks for user's location on page load
2. **Distance Display** - Shows distance to each hotel (if location granted)
3. **Category Filter** - Filter by hotel category
4. **Enhanced Search** - Searches name, city, description, and tags
5. **Sort Options** - Sort by name, rating, or distance
6. **Rich Hotel Cards** - Display category badges, rating stars, tags, parking info

**UI Components:**

```
┌─────────────────────────────────────────────────────┐
│  📍 Location: Enabled (or error message)            │
├─────────────────────────────────────────────────────┤
│  [Search...] [City ▼] [Category ▼] [Sort by ▼]      │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │ Grand Hotel      │  │ Seaside Resort   │         │
│  │ ⭐ 4.5  Luxury   │  │ ⭐ 4.2  Resort   │         │
│  │ 📍 New York      │  │ 📍 Miami         │         │
│  │ 🚗 Free Parking  │  │ 2.3 km away      │         │
│  │ pool, spa, gym   │  │ beach, pool      │         │
│  └──────────────────┘  └──────────────────┘         │
└─────────────────────────────────────────────────────┘
```

### Hotel Detail Page

**Route:** `/hotels/$hotelId`

Enhanced to display:

**Hotel Section:**

- Dynamic rating (from data, not hardcoded)
- Category badge with color coding
- Full description
- State/province and postal code
- Parking included badge
- Last renovation year
- Tags list

**Room Cards:**

- Room description
- Bed options (e.g., "2 Queen Beds")
- Smoking/non-smoking indicator

**Category Badge Colors:**

| Category       | Color   |
| -------------- | ------- |
| Luxury         | Amber   |
| Boutique       | Purple  |
| Resort and Spa | Emerald |
| Suite          | Blue    |
| Extended-Stay  | Cyan    |
| Budget         | Slate   |

## File Locations

| File                                            | Purpose                            |
| ----------------------------------------------- | ---------------------------------- |
| `convex/schema.ts`                              | Extended schema with new fields    |
| `convex/seed.ts`                                | Seed mutations                     |
| `convex/hotels.ts`                              | Updated validators                 |
| `convex/rooms.ts`                               | Updated validators and room types  |
| `scripts/seed-hotels.ts`                        | Import script                      |
| `src/lib/distance.ts`                           | Haversine distance calculation     |
| `src/hooks/useGeolocation.ts`                   | Browser geolocation hook           |
| `src/routes/_authenticated/select-location.tsx` | Enhanced hotel listing             |
| `src/routes/_authenticated/hotels.$hotelId.tsx` | Enhanced hotel detail              |
| `Hotel_data/Hotel.json`                         | Source data (50 hotels, 757 rooms) |

## Important Notes

### Prices in Cents

All prices are stored in cents to avoid floating-point issues:

```typescript
// $96.99 in the JSON becomes:
basePrice: 9699

// Display as dollars:
const dollars = (room.basePrice / 100).toFixed(2) // "96.99"
```

### Date Format

Dates are stored as "YYYY-MM-DD" strings:

```typescript
lastRenovationDate: '2022-01-18' // Not a Date object or timestamp
```

### Location Coordinates

The JSON uses GeoJSON format `[longitude, latitude]`, but we store as `{lat, lng}`:

```typescript
// Source (GeoJSON):
"coordinates": [-73.975, 40.760]

// Stored in Convex:
location: { lat: 40.760, lng: -73.975 }
```

### Geolocation Requirements

- **Development:** Works on `localhost` (HTTP)
- **Production:** Requires HTTPS
- **User Permission:** Browser will prompt for location access

### Room Type Migration

Room types changed from the original schema:

| Old      | New                  |
| -------- | -------------------- |
| `single` | `budget`             |
| `double` | `standard`           |
| `suite`  | `suite` (unchanged)  |
| `deluxe` | `deluxe` (unchanged) |

This was done to align with the imported hotel data format.
