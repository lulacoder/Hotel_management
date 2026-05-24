import { ConvexError } from 'convex/values'
import { QueryCtx } from '../_generated/server'
import { Id } from '../_generated/dataModel'
import { DateRange, datesOverlap, isHoldExpired } from './dates'

/**
 * Booking statuses that mean the booking is over and no longer holds the room.
 * Bookings in these states are skipped during date-conflict checks.
 * NOTE: 'outsourced' is intentionally included — the guest was moved to another
 * hotel so the original room is free.
 */
export const TERMINAL_STATUSES = [
  'cancelled',
  'expired',
  'checked_out',
  'outsourced',
] as const

function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status)
}

/**
 * Throws a CONFLICT ConvexError if the room has any active booking that
 * overlaps the requested date range.
 * Called by holdRoom() and walkInBooking() in bookings.ts.
 */
export async function assertRoomAvailable(
  ctx: QueryCtx,
  roomId: Id<'rooms'>,
  range: DateRange,
): Promise<void> {
  const existingBookings = await ctx.db
    .query('bookings')
    .withIndex('by_room_and_dates', (q) =>
      q.eq('roomId', roomId).lt('checkIn', range.checkOut),
    )
    .collect()

  for (const booking of existingBookings) {
    if (isTerminal(booking.status)) continue
    if (booking.status === 'held' && isHoldExpired(booking.holdExpiresAt))
      continue

    if (
      datesOverlap(range, {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      })
    ) {
      throw new ConvexError({
        code: 'CONFLICT',
        message:
          'Room is not available for the selected dates. Please choose different dates.',
      })
    }
  }
}

/**
 * Returns availability status for a room without throwing.
 * Called by checkAvailability() in rooms.ts.
 */
export async function checkRoomAvailability(
  ctx: QueryCtx,
  roomId: Id<'rooms'>,
  range: DateRange,
): Promise<{ available: boolean; reason?: string }> {
  const existingBookings = await ctx.db
    .query('bookings')
    .withIndex('by_room_and_dates', (q) =>
      q.eq('roomId', roomId).lt('checkIn', range.checkOut),
    )
    .collect()

  for (const booking of existingBookings) {
    if (isTerminal(booking.status)) continue
    if (booking.status === 'held' && isHoldExpired(booking.holdExpiresAt))
      continue

    if (
      datesOverlap(range, {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      })
    ) {
      return { available: false, reason: 'Room is already booked for these dates' }
    }
  }

  return { available: true }
}

/**
 * Returns the set of room IDs (from the provided candidates) that are blocked
 * by an active booking overlapping the date range. Uses a single hotel-scoped
 * index scan instead of one scan per room.
 * Called by getAvailableRooms() in rooms.ts.
 */
export async function findBlockedRoomIds(
  ctx: QueryCtx,
  hotelId: Id<'hotels'>,
  candidateRoomIds: Set<Id<'rooms'>>,
  range: DateRange,
): Promise<Set<Id<'rooms'>>> {
  const blockedRoomIds = new Set<Id<'rooms'>>()

  const candidateBookings = await ctx.db
    .query('bookings')
    .withIndex('by_hotel_and_check_in', (q) =>
      q.eq('hotelId', hotelId).lt('checkIn', range.checkOut),
    )
    .collect()

  for (const booking of candidateBookings) {
    if (!candidateRoomIds.has(booking.roomId)) continue
    if (isTerminal(booking.status)) continue
    if (booking.status === 'held' && isHoldExpired(booking.holdExpiresAt))
      continue

    if (
      datesOverlap(range, {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      })
    ) {
      blockedRoomIds.add(booking.roomId)
    }
  }

  return blockedRoomIds
}
