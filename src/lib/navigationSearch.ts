export const DEFAULT_ADMIN_DASHBOARD_SEARCH = {
  window: '7d' as const,
}

export const DEFAULT_AUTH_SEARCH = {
  redirect: undefined as string | undefined,
}

export const DEFAULT_HOTEL_DETAIL_SEARCH = {
  resumeBookingId: undefined as string | undefined,
}

export const DEFAULT_SELECT_LOCATION_SEARCH = {
  category: 'all',
  city: 'all',
  q: '',
  rate: undefined as string | undefined,
  sort: 'name' as const,
}
