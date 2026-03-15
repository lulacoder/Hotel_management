import type { Id } from '../_generated/dataModel'
import type { AnalyticsBucket } from './adminAnalyticsWindow'
import { doesStayOverlapDate } from './adminAnalyticsWindow'

export interface AnalyticsBookingRecord {
  _id?: Id<'bookings'>
  hotelId: Id<'hotels'>
  roomId: Id<'rooms'>
  createdAt: number
  checkIn: string
  checkOut: string
  status: string
  paymentStatus?: string
  totalPrice: number
}

export interface AnalyticsRoomRecord {
  _id: Id<'rooms'>
  hotelId: Id<'hotels'>
  operationalStatus: 'available' | 'maintenance' | 'cleaning' | 'out_of_order'
  isDeleted: boolean
}

export interface AnalyticsHotelRecord {
  _id: Id<'hotels'>
  name: string
  isDeleted: boolean
}

export interface TrendPoint {
  key: string
  label: string
  value: number
}

export interface OccupancyPoint {
  key: string
  label: string
  occupiedRooms: number
  totalRooms: number
  occupancyRate: number
}

export interface TopHotelRanking {
  hotelId: Id<'hotels'>
  hotelName: string
  collectedRevenue: number
  bookingCount: number
  occupancyRate: number
}

export function calculateCollectedRevenue(
  bookings: AnalyticsBookingRecord[],
): number {
  return bookings.reduce((sum, booking) => {
    return booking.paymentStatus === 'paid' ? sum + booking.totalPrice : sum
  }, 0)
}

export function calculateConfirmedRevenuePipeline(
  bookings: AnalyticsBookingRecord[],
): number {
  return bookings.reduce((sum, booking) => {
    if (
      ['confirmed', 'checked_in'].includes(booking.status) &&
      (!booking.paymentStatus || booking.paymentStatus === 'pending')
    ) {
      return sum + booking.totalPrice
    }

    return sum
  }, 0)
}

export function countActiveStays(bookings: AnalyticsBookingRecord[]): number {
  return bookings.filter((booking) => booking.status === 'checked_in').length
}

export function countArrivalsForDate(
  bookings: AnalyticsBookingRecord[],
  dateKey: string,
): number {
  return bookings.filter(
    (booking) =>
      booking.checkIn === dateKey &&
      !['cancelled', 'expired'].includes(booking.status),
  ).length
}

export function countDeparturesForDate(
  bookings: AnalyticsBookingRecord[],
  dateKey: string,
): number {
  return bookings.filter(
    (booking) =>
      booking.checkOut === dateKey &&
      !['cancelled', 'expired'].includes(booking.status),
  ).length
}

export function countPendingPaymentBookings(
  bookings: AnalyticsBookingRecord[],
): number {
  return bookings.filter(
    (booking) =>
      ['pending_payment', 'confirmed', 'checked_in'].includes(booking.status) &&
      (!booking.paymentStatus || booking.paymentStatus === 'pending'),
  ).length
}

export function buildBookingStatusCounts(
  bookings: AnalyticsBookingRecord[],
): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>()

  for (const booking of bookings) {
    counts.set(booking.status, (counts.get(booking.status) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

export function buildPaymentStatusCounts(
  bookings: AnalyticsBookingRecord[],
): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>()

  for (const booking of bookings) {
    const key = booking.paymentStatus ?? 'unpaid_unknown'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

export function buildRoomStatusCounts(
  rooms: AnalyticsRoomRecord[],
): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>()

  for (const room of rooms) {
    if (room.isDeleted) {
      continue
    }

    counts.set(
      room.operationalStatus,
      (counts.get(room.operationalStatus) ?? 0) + 1,
    )
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

export function buildRevenueTrendSeries(
  bookings: AnalyticsBookingRecord[],
  buckets: AnalyticsBucket[],
): TrendPoint[] {
  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: bookings.reduce((sum, booking) => {
      if (
        booking.paymentStatus === 'paid' &&
        booking.createdAt >= bucket.startMs &&
        booking.createdAt <= bucket.endMs
      ) {
        return sum + booking.totalPrice
      }

      return sum
    }, 0),
  }))
}

export function buildBookingTrendSeries(
  bookings: AnalyticsBookingRecord[],
  buckets: AnalyticsBucket[],
): TrendPoint[] {
  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: bookings.filter(
      (booking) =>
        booking.createdAt >= bucket.startMs &&
        booking.createdAt <= bucket.endMs,
    ).length,
  }))
}

export function buildOccupancyTrendSeries(
  rooms: AnalyticsRoomRecord[],
  bookings: AnalyticsBookingRecord[],
  buckets: AnalyticsBucket[],
): OccupancyPoint[] {
  const activeRooms = rooms.filter((room) => !room.isDeleted)

  return buckets.map((bucket) => {
    const usableRooms = activeRooms.filter(
      (room) => room.operationalStatus !== 'out_of_order',
    )
    const occupiedRoomIds = new Set<Id<'rooms'>>()

    for (const booking of bookings) {
      if (
        !['confirmed', 'checked_in', 'checked_out'].includes(booking.status)
      ) {
        continue
      }

      if (doesStayOverlapDate(booking.checkIn, booking.checkOut, bucket.key)) {
        occupiedRoomIds.add(booking.roomId)
      }
    }

    const occupiedRooms = usableRooms.filter((room) =>
      occupiedRoomIds.has(room._id),
    ).length
    const totalRooms = usableRooms.length

    return {
      key: bucket.key,
      label: bucket.label,
      occupiedRooms,
      totalRooms,
      occupancyRate: totalRooms > 0 ? occupiedRooms / totalRooms : 0,
    }
  })
}

export function buildTopHotelRankings(
  hotels: AnalyticsHotelRecord[],
  rooms: AnalyticsRoomRecord[],
  bookings: AnalyticsBookingRecord[],
  currentOccupancyPoints: OccupancyPoint[],
): TopHotelRanking[] {
  const activeHotels = hotels.filter((hotel) => !hotel.isDeleted)
  const latestOccupancy =
    currentOccupancyPoints[currentOccupancyPoints.length - 1]
  const hotelIdsWithRooms = new Map<Id<'hotels'>, AnalyticsRoomRecord[]>()

  for (const room of rooms) {
    if (room.isDeleted) {
      continue
    }

    const existing = hotelIdsWithRooms.get(room.hotelId) ?? []
    existing.push(room)
    hotelIdsWithRooms.set(room.hotelId, existing)
  }

  return activeHotels
    .map((hotel) => {
      const hotelBookings = bookings.filter(
        (booking) => booking.hotelId === hotel._id,
      )
      const hotelRooms = hotelIdsWithRooms.get(hotel._id) ?? []
      const hotelOccupancy = buildOccupancyTrendSeries(
        hotelRooms,
        hotelBookings,
        [
          {
            key: latestOccupancy?.key ?? 'current',
            label: latestOccupancy?.label ?? 'Current',
            startMs: 0,
            endMs: 0,
          },
        ],
      )[0]

      return {
        hotelId: hotel._id,
        hotelName: hotel.name,
        collectedRevenue: calculateCollectedRevenue(hotelBookings),
        bookingCount: hotelBookings.length,
        occupancyRate: hotelOccupancy?.occupancyRate ?? 0,
      }
    })
    .sort((a, b) => b.collectedRevenue - a.collectedRevenue)
}
