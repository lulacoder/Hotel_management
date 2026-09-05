import { ConvexError } from 'convex/values'

// Shared input caps for booking, hotel, room and rating writes
export const GUEST_NAME_MAX = 100
export const EMAIL_MAX = 254
export const SPECIAL_REQUESTS_MAX = 2000
export const TRANSACTION_ID_MAX = 100
export const HOTEL_TEXT_MAX = 200
export const HOTEL_DESCRIPTION_MAX = 2000
export const ROOM_NUMBER_MAX = 50
export const ROOM_TEXT_MAX = 200
export const ROOM_DESCRIPTION_MAX = 2000
export const SEARCH_TERM_MAX = 100
export const TX_REF_MIN = 6
export const TX_REF_MAX = 100

// Trims a string and rejects it when it exceeds the cap
export function trimAndCap(value: string, max: number, field: string) {
  const trimmed = value.trim()
  if (trimmed.length > max) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: `${field} must be ${max} characters or less.`,
    })
  }
  return trimmed
}

// Validates an optional guest name, returning trimmed value or undefined
export function validateGuestName(value?: string) {
  if (value === undefined) return undefined
  const trimmed = trimAndCap(value, GUEST_NAME_MAX, 'Guest name')
  return trimmed.length > 0 ? trimmed : undefined
}

// Validates an optional email with a simple shape check
export function validateGuestEmail(value?: string) {
  if (value === undefined) return undefined
  const trimmed = trimAndCap(value, EMAIL_MAX, 'Email').toLowerCase()
  if (!trimmed) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: 'Email address is invalid.',
    })
  }
  return trimmed
}

// Validates optional free text like special requests
export function validateSpecialRequests(value?: string) {
  if (value === undefined) return undefined
  const trimmed = trimAndCap(value, SPECIAL_REQUESTS_MAX, 'Special requests')
  return trimmed.length > 0 ? trimmed : undefined
}

// Validates a transaction id after trimming
export function validateTransactionId(value: string) {
  const trimmed = trimAndCap(value, TRANSACTION_ID_MAX, 'Transaction ID')
  if (!trimmed) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: 'Transaction ID is required.',
    })
  }
  return trimmed
}

// Validates required hotel text fields like name, address, city and country
export function validateHotelText(value: string, field: string) {
  const trimmed = trimAndCap(value, HOTEL_TEXT_MAX, field)
  if (!trimmed) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: `${field} is required.`,
    })
  }
  return trimmed
}

// Validates optional hotel description
export function validateHotelDescription(value?: string) {
  if (value === undefined) return undefined
  const trimmed = trimAndCap(value, HOTEL_DESCRIPTION_MAX, 'Description')
  return trimmed.length > 0 ? trimmed : undefined
}

// Validates a Chapa transaction reference shape before network calls
export function validateTxRef(value: string) {
  const trimmed = value.trim()
  if (
    trimmed.length < TX_REF_MIN ||
    trimmed.length > TX_REF_MAX ||
    !/^[A-Za-z0-9_-]+$/.test(trimmed)
  ) {
    throw new ConvexError({
      code: 'INVALID_INPUT',
      message: 'Transaction reference is invalid.',
    })
  }
  return trimmed
}

// Clamps a limit into a safe inclusive range with a fallback
export function clampLimit(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === undefined) return fallback
  if (!Number.isInteger(value)) return fallback
  return Math.min(max, Math.max(min, value))
}
