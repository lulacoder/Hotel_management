const ADDIS_TIME_ZONE = 'Africa/Addis_Ababa'

// Returns the calendar date currently in effect at the hotel deadline
export function getAddisDate(now: number): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: ADDIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now))
  // Reassemble locale parts into the database's stable date key format
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}
