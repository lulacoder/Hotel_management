import { ConvexError } from 'convex/values'

export interface DateRange {
  checkIn: string // YYYY-MM-DD
  checkOut: string // YYYY-MM-DD
}

// Constants for validation
const MAX_STAY_NIGHTS = 30 // Maximum number of nights for a single booking
const MAX_ADVANCE_BOOKING_DAYS = 365 // How far in advance bookings can be made

/**
 * Parse a YYYY-MM-DD date string to a Date object (UTC midnight)
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Get today's date as YYYY-MM-DD string (UTC)
 */
export function getTodayString(): string {
  return formatDate(new Date())
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
export function isValidDateFormat(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateStr)) return false

  const date = parseDate(dateStr)
  return !isNaN(date.getTime())
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  const checkInDate = parseDate(checkIn)
  const checkOutDate = parseDate(checkOut)
  const diffTime = checkOutDate.getTime() - checkInDate.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if two date ranges overlap
 * Uses the formula: (checkInA < checkOutB) AND (checkOutA > checkInB)
 */
export function datesOverlap(rangeA: DateRange, rangeB: DateRange): boolean {
  const checkInA = parseDate(rangeA.checkIn)
  const checkOutA = parseDate(rangeA.checkOut)
  const checkInB = parseDate(rangeB.checkIn)
  const checkOutB = parseDate(rangeB.checkOut)

  return checkInA < checkOutB && checkOutA > checkInB
}

/**
 * Validate booking dates with full business rules
 * Throws ConvexError with specific messages for each validation failure
 */
export function validateBookingDates(
  checkIn: string,
  checkOut: string,
): { nights: number } {
  // Validate date formats
  if (!isValidDateFormat(checkIn)) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: 'Invalid check-in date format. Use YYYY-MM-DD.',
    })
  }

  if (!isValidDateFormat(checkOut)) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: 'Invalid check-out date format. Use YYYY-MM-DD.',
    })
  }

  const checkInDate = parseDate(checkIn)
  const checkOutDate = parseDate(checkOut)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // Check-in must be today or in the future
  if (checkInDate < today) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: 'Check-in date cannot be in the past.',
    })
  }

  // Check-out must be after check-in
  if (checkOutDate <= checkInDate) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: 'Check-out date must be after check-in date.',
    })
  }

  // Calculate nights
  const nights = calculateNights(checkIn, checkOut)

  // Maximum stay validation
  if (nights > MAX_STAY_NIGHTS) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: `Maximum stay is ${MAX_STAY_NIGHTS} nights. Your booking is for ${nights} nights.`,
    })
  }

  // Maximum advance booking validation
  const maxAdvanceDate = new Date(today)
  maxAdvanceDate.setDate(maxAdvanceDate.getDate() + MAX_ADVANCE_BOOKING_DAYS)

  if (checkInDate > maxAdvanceDate) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: `Bookings can only be made up to ${MAX_ADVANCE_BOOKING_DAYS} days in advance.`,
    })
  }

  return { nights }
}

/**
 * Check if a date is in the past
 */
export function isDateInPast(dateStr: string): boolean {
  const date = parseDate(dateStr)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return date < today
}

/**
 * Get the hold expiration timestamp (15 minutes from now)
 */
export function getHoldExpirationTime(): number {
  return Date.now() + 15 * 60 * 1000 // 15 minutes in milliseconds
}

/**
 * Check if a hold has expired
 */
export function isHoldExpired(holdExpiresAt: number | undefined): boolean {
  if (!holdExpiresAt) return false
  return Date.now() > holdExpiresAt
}
