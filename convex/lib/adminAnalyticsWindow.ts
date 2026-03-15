import { formatDate, parseDate } from './dates'

export type AnalyticsWindow = 'today' | '7d' | '30d'
export type AnalyticsBucketType = 'hour' | 'day'

export interface AnalyticsWindowRange {
  startMs: number
  endMs: number
  bucketType: AnalyticsBucketType
}

export interface AnalyticsBucket {
  key: string
  label: string
  startMs: number
  endMs: number
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function getUtcDayStart(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function formatHourLabel(startMs: number): string {
  const hour = new Date(startMs).getUTCHours()
  return `${hour.toString().padStart(2, '0')}:00`
}

function formatDayLabel(startMs: number): string {
  const date = new Date(startMs)
  const month = date.toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
  return `${month} ${date.getUTCDate()}`
}

export function getAnalyticsWindowRange(
  window: AnalyticsWindow,
  nowMs = Date.now(),
): AnalyticsWindowRange {
  const endMs = nowMs
  const utcDayStart = getUtcDayStart(nowMs)

  if (window === 'today') {
    return {
      startMs: utcDayStart,
      endMs,
      bucketType: 'hour',
    }
  }

  const dayCount = window === '7d' ? 7 : 30

  return {
    startMs: utcDayStart - (dayCount - 1) * DAY_MS,
    endMs,
    bucketType: 'day',
  }
}

export function buildWindowBuckets(
  window: AnalyticsWindow,
  nowMs = Date.now(),
): AnalyticsBucket[] {
  const range = getAnalyticsWindowRange(window, nowMs)

  if (window === 'today') {
    const buckets: AnalyticsBucket[] = []
    const currentHourStart = Math.floor(nowMs / HOUR_MS) * HOUR_MS

    for (
      let bucketStart = range.startMs;
      bucketStart <= currentHourStart;
      bucketStart += HOUR_MS
    ) {
      buckets.push({
        key: formatHourLabel(bucketStart),
        label: formatHourLabel(bucketStart),
        startMs: bucketStart,
        endMs: Math.min(bucketStart + HOUR_MS - 1, range.endMs),
      })
    }

    return buckets
  }

  const buckets: AnalyticsBucket[] = []
  for (
    let bucketStart = range.startMs;
    bucketStart <= range.endMs;
    bucketStart += DAY_MS
  ) {
    const dateKey = getUtcDateKey(bucketStart)
    buckets.push({
      key: dateKey,
      label: formatDayLabel(bucketStart),
      startMs: bucketStart,
      endMs: Math.min(bucketStart + DAY_MS - 1, range.endMs),
    })
  }

  return buckets
}

export function buildDailyWindowBuckets(
  window: AnalyticsWindow,
  nowMs = Date.now(),
): AnalyticsBucket[] {
  const range = getAnalyticsWindowRange(window, nowMs)
  const startMs = window === 'today' ? getUtcDayStart(nowMs) : range.startMs
  const endMs = range.endMs
  const buckets: AnalyticsBucket[] = []

  for (let bucketStart = startMs; bucketStart <= endMs; bucketStart += DAY_MS) {
    const dateKey = getUtcDateKey(bucketStart)
    buckets.push({
      key: dateKey,
      label: formatDayLabel(bucketStart),
      startMs: bucketStart,
      endMs: Math.min(bucketStart + DAY_MS - 1, endMs),
    })
  }

  return buckets
}

export function isTimestampInWindow(
  timestamp: number,
  range: AnalyticsWindowRange,
): boolean {
  return timestamp >= range.startMs && timestamp <= range.endMs
}

export function getUtcDateKey(value: Date | number): string {
  return formatDate(
    new Date(typeof value === 'number' ? value : value.getTime()),
  )
}

export function enumerateStayDates(
  checkIn: string,
  checkOut: string,
): string[] {
  const dates: string[] = []
  const cursor = parseDate(checkIn)
  const end = parseDate(checkOut)

  while (cursor < end) {
    dates.push(formatDate(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

export function doesStayOverlapDate(
  checkIn: string,
  checkOut: string,
  dateKey: string,
): boolean {
  const target = parseDate(dateKey)
  const start = parseDate(checkIn)
  const end = parseDate(checkOut)
  return start <= target && target < end
}
