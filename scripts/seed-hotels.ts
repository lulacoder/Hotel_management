/**
 * Seed script to import Hotel.json data into Convex
 *
 * Run with: npx tsx scripts/seed-hotels.ts
 *
 * Make sure `npx convex dev` is running in another terminal first!
 */

import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables from .env.local
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL

if (!CONVEX_URL) {
  console.error(
    'Error: CONVEX_URL or VITE_CONVEX_URL environment variable not set',
  )
  console.error(
    'Make sure you have a .env.local file with your Convex deployment URL',
  )
  process.exit(1)
}

console.log(`Connecting to Convex at: ${CONVEX_URL}\n`)
const client = new ConvexHttpClient(CONVEX_URL)

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
    coordinates: [number, number]
  }
  Rooms: JsonRoom[]
}

interface HotelJson {
  value: JsonHotel[]
}

async function seedHotels() {
  console.log('🏨 Starting Hotel Data Import...\n')

  // Read the JSON file
  const jsonPath = path.join(__dirname, '..', 'Hotel_data', 'Hotel.json')

  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: Hotel.json not found at ${jsonPath}`)
    process.exit(1)
  }

  const jsonData: HotelJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  const hotels = jsonData.value

  console.log(`📊 Found ${hotels.length} hotels to import\n`)

  // Track stats
  let totalRooms = 0
  let successCount = 0
  let failCount = 0

  // Process each hotel
  for (const hotel of hotels) {
    try {
      const result = await client.mutation(api.seed.seedHotel, { hotel })
      totalRooms += result.roomCount
      successCount++
      console.log(
        `✅ [${successCount}/${hotels.length}] ${hotel.HotelName} - ${result.roomCount} rooms`,
      )
    } catch (error: any) {
      failCount++
      console.error(`❌ Failed to import ${hotel.HotelName}: ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📈 Import Summary:')
  console.log(`   Hotels imported: ${successCount}/${hotels.length}`)
  console.log(`   Total rooms: ${totalRooms}`)
  if (failCount > 0) {
    console.log(`   Failed: ${failCount}`)
  }
  console.log('='.repeat(50))

  if (successCount === hotels.length) {
    console.log('\n🎉 All hotels imported successfully!')
  }
}

async function clearData() {
  console.log('🗑️  Clearing existing hotels and rooms...')
  try {
    const result = await client.mutation(api.seed.clearAllHotelsAndRooms, {})
    console.log(
      `   Deleted ${result.hotelsDeleted} hotels and ${result.roomsDeleted} rooms\n`,
    )
  } catch (error: any) {
    console.error(`Failed to clear data: ${error.message}`)
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--clear')) {
    await clearData()
  }

  if (args.includes('--clear-only')) {
    await clearData()
    return
  }

  await seedHotels()
}

main().catch(console.error)
