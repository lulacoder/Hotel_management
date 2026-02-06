/**
 * Distance calculation utilities using the Haversine formula
 * for calculating great-circle distances between two points on Earth
 */

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 - Latitude of point 1
 * @param lng1 - Longitude of point 1
 * @param lat2 - Latitude of point 2
 * @param lng2 - Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

/**
 * Format distance for display
 * @param distanceKm - Distance in kilometers
 * @returns Formatted string (e.g., "2.5 km" or "500 m")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    // Show in meters for short distances
    return `${Math.round(distanceKm * 1000)} m`
  } else if (distanceKm < 10) {
    // Show one decimal for distances under 10km
    return `${distanceKm.toFixed(1)} km`
  } else {
    // Round to nearest km for longer distances
    return `${Math.round(distanceKm)} km`
  }
}

/**
 * Calculate distance in miles
 */
export function calculateDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const km = calculateDistance(lat1, lng1, lat2, lng2)
  return km * 0.621371 // Convert km to miles
}

/**
 * Format distance in miles for display
 */
export function formatDistanceMiles(distanceMiles: number): string {
  if (distanceMiles < 0.1) {
    // Show in feet for very short distances
    return `${Math.round(distanceMiles * 5280)} ft`
  } else if (distanceMiles < 10) {
    return `${distanceMiles.toFixed(1)} mi`
  } else {
    return `${Math.round(distanceMiles)} mi`
  }
}
