import type { Locale } from '@/lib/i18n'

export type AnalyticsWindow = 'today' | '7d' | '30d'
export type BookingStatusFilter =
  | 'all'
  | 'held'
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'expired'
  | 'outsourced'

export type PaymentStatusFilter =
  | 'all'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'unpaid_unknown'

export type RoomOperationalStatusFilter =
  | 'all'
  | 'available'
  | 'maintenance'
  | 'cleaning'
  | 'out_of_order'

const localeMap: Record<Locale, string> = {
  en: 'en-US',
  am: 'am-ET',
}

export const analyticsWindowOptions: Array<{
  value: AnalyticsWindow
  labelKey:
    | 'admin.analytics.window.today'
    | 'admin.analytics.window.7d'
    | 'admin.analytics.window.30d'
}> = [
  { value: 'today', labelKey: 'admin.analytics.window.today' },
  { value: '7d', labelKey: 'admin.analytics.window.7d' },
  { value: '30d', labelKey: 'admin.analytics.window.30d' },
]

export function normalizeAnalyticsWindow(value: unknown): AnalyticsWindow {
  return value === 'today' || value === '7d' || value === '30d' ? value : '7d'
}

export function normalizeBookingStatusFilter(
  value: unknown,
): BookingStatusFilter {
  return [
    'all',
    'held',
    'pending_payment',
    'confirmed',
    'checked_in',
    'checked_out',
    'cancelled',
    'expired',
    'outsourced',
  ].includes(String(value))
    ? (value as BookingStatusFilter)
    : 'all'
}

export function normalizePaymentStatusFilter(
  value: unknown,
): PaymentStatusFilter {
  return [
    'all',
    'pending',
    'paid',
    'failed',
    'refunded',
    'unpaid_unknown',
  ].includes(String(value))
    ? (value as PaymentStatusFilter)
    : 'all'
}

export function normalizeRoomOperationalStatusFilter(
  value: unknown,
): RoomOperationalStatusFilter {
  return [
    'all',
    'available',
    'maintenance',
    'cleaning',
    'out_of_order',
  ].includes(String(value))
    ? (value as RoomOperationalStatusFilter)
    : 'all'
}

export function formatAnalyticsCurrency(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatAnalyticsPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatAnalyticsCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}
