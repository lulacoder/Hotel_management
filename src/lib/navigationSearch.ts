export const DEFAULT_ADMIN_DASHBOARD_SEARCH = {
  window: '7d' as const,
}

export const DEFAULT_AUTH_SEARCH = {
  redirect: undefined as string | undefined,
}

export const DEFAULT_HOTEL_DETAIL_SEARCH = {
  checkIn: undefined as string | undefined,
  checkOut: undefined as string | undefined,
  guests: undefined as number | undefined,
  resumeBookingId: undefined as string | undefined,
}

export const DEFAULT_SELECT_LOCATION_SEARCH = {
  category: 'all',
  checkIn: '',
  checkOut: '',
  city: 'all',
  guests: 1,
  q: '',
  rate: undefined as string | undefined,
  sort: 'name' as const,
}

export function getTodayDateString(): string {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Checkout must be at least one calendar day after check-in.
export function getMinimumCheckoutDate(checkIn: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) return undefined
  const date = new Date(`${checkIn}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
