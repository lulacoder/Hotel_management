import type { Locale } from '../../../../lib/i18n'

const localeMap: Record<Locale, string> = {
  en: 'en-US',
  am: 'am-ET',
}

// Shared formatting and status helpers for the customer bookings UI.
export const formatDate = (dateStr: string, locale: Locale) => {
  // Human-friendly booking date for list/detail surfaces.
  return new Date(dateStr).toLocaleDateString(localeMap[locale], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const formatTime = (timestamp: number, locale: Locale) => {
  return new Date(timestamp).toLocaleTimeString(localeMap[locale], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatPrice = (cents: number) => {
  // Price storage is cents; convert to display currency.
  return `$${(cents / 100).toFixed(2)}`
}

export const canCancel = (status: string) => {
  // Cancellation is only allowed before stay completion.
  return ['held', 'pending_payment', 'confirmed'].includes(status)
}
