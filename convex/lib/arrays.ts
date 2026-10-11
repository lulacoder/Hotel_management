// Removes missing IDs and duplicates while preserving the supplied ID type
export function uniqueIds<T>(ids: Array<T | undefined | null>): Array<T> {
  // Keep provided IDs without discarding other valid falsy values
  const presentIds = ids.filter((id) => id !== null && id !== undefined)
  return [...new Set(presentIds)]
}
