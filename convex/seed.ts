import { mutation } from './_generated/server'
import { v } from 'convex/values'

// Category type for validation
type HotelCategory =
  | 'Boutique'
  | 'Budget'
  | 'Luxury'
  | 'Resort and Spa'
  | 'Extended-Stay'
  | 'Suite'

// Room type mapping from JSON to our schema
type RoomType = 'budget' | 'standard' | 'suite' | 'deluxe'

const mapRoomType = (jsonType: string): RoomType => {
  const type = jsonType.toLowerCase().replace(' room', '')
  switch (type) {
    case 'budget':
      return 'budget'
    case 'standard':
      return 'standard'
    case 'suite':
      return 'suite'
    case 'deluxe':
      return 'deluxe'
    default:
      return 'standard' // fallback
  }
}

// Hotel data structure from JSON
interface JsonRoom {
  Description: string
  Type: string
  BaseRate: number
  BedOptions: string
  SleepsCount: number
  SmokingAllowed: boolean
  Tags: string[]
}

interface JsonHotel {
  HotelId: string
  HotelName: string
  Description: string
  Category: string
  Tags: string[]
  ParkingIncluded: boolean
  LastRenovationDate: string
  Rating: number
  Address: {
    StreetAddress: string
    City: string
    StateProvince: string
    PostalCode: string
    Country: string
  }
  Location: {
    type: string
    coordinates: [number, number] // [longitude, latitude]
  }
  Rooms: JsonRoom[]
}

// Seed a single hotel with its rooms
export const seedHotel = mutation({
  args: {
    hotel: v.any(), // We'll validate inside
  },
  returns: v.object({
    hotelId: v.id('hotels'),
    roomCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const h = args.hotel as JsonHotel
    const now = Date.now()

    // Parse last renovation date to YYYY-MM-DD
    const lastRenovationDate = h.LastRenovationDate
      ? h.LastRenovationDate.split('T')[0]
      : undefined

    // Convert GeoJSON [lng, lat] to our {lat, lng}
    const location = h.Location?.coordinates
      ? {
          lat: h.Location.coordinates[1],
          lng: h.Location.coordinates[0],
        }
      : undefined

    // Validate and cast category
    const validCategories: HotelCategory[] = [
      'Boutique',
      'Budget',
      'Luxury',
      'Resort and Spa',
      'Extended-Stay',
      'Suite',
    ]
    const category = validCategories.includes(h.Category as HotelCategory)
      ? (h.Category as HotelCategory)
      : undefined

    // Insert hotel
    const hotelId = await ctx.db.insert('hotels', {
      name: h.HotelName,
      address: h.Address.StreetAddress,
      city: h.Address.City,
      country: h.Address.Country,
      location,
      externalId: h.HotelId,
      description: h.Description,
      category,
      tags: h.Tags,
      parkingIncluded: h.ParkingIncluded,
      rating: h.Rating,
      stateProvince: h.Address.StateProvince,
      postalCode: h.Address.PostalCode,
      lastRenovationDate,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    // Insert rooms with auto-generated room numbers
    let roomNumber = 101
    for (const room of h.Rooms) {
      // Convert price from dollars to cents
      const basePrice = Math.round(room.BaseRate * 100)

      await ctx.db.insert('rooms', {
        hotelId,
        roomNumber: String(roomNumber),
        type: mapRoomType(room.Type),
        basePrice,
        maxOccupancy: room.SleepsCount,
        operationalStatus: 'available',
        amenities: room.Tags,
        description: room.Description,
        bedOptions: room.BedOptions,
        smokingAllowed: room.SmokingAllowed,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      roomNumber++
    }

    return {
      hotelId,
      roomCount: h.Rooms.length,
    }
  },
})

// Clear all hotels and rooms (for re-seeding)
export const clearAllHotelsAndRooms = mutation({
  args: {},
  returns: v.object({
    hotelsDeleted: v.number(),
    roomsDeleted: v.number(),
  }),
  handler: async (ctx) => {
    // Delete all rooms
    const rooms = await ctx.db.query('rooms').collect()
    for (const room of rooms) {
      await ctx.db.delete(room._id)
    }

    // Delete all hotels
    const hotels = await ctx.db.query('hotels').collect()
    for (const hotel of hotels) {
      await ctx.db.delete(hotel._id)
    }

    return {
      hotelsDeleted: hotels.length,
      roomsDeleted: rooms.length,
    }
  },
})
