import { useState, useEffect, useCallback } from 'react'

export interface GeolocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: GeolocationPositionError | null
  loading: boolean
  supported: boolean
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  /** If true, starts watching position on mount */
  watchOnMount?: boolean
}

const defaultOptions: UseGeolocationOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000, // Cache position for 1 minute
  watchOnMount: false,
}

/**
 * React hook for accessing browser geolocation
 *
 * @example
 * const { latitude, longitude, error, loading, requestLocation } = useGeolocation()
 *
 * useEffect(() => {
 *   requestLocation()
 * }, [requestLocation])
 */
export function useGeolocation(options: UseGeolocationOptions = {}) {
  const opts = { ...defaultOptions, ...options }

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
    supported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
  })

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      error: null,
      loading: false,
      supported: true,
    })
  }, [])

  const handleError = useCallback((error: GeolocationPositionError) => {
    setState((prev) => ({
      ...prev,
      error,
      loading: false,
    }))
  }, [])

  const requestLocation = useCallback(() => {
    if (!state.supported) {
      setState((prev) => ({
        ...prev,
        error: {
          code: 2,
          message: 'Geolocation is not supported by this browser',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError,
        loading: false,
      }))
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: opts.enableHighAccuracy,
      timeout: opts.timeout,
      maximumAge: opts.maximumAge,
    })
  }, [
    state.supported,
    handleSuccess,
    handleError,
    opts.enableHighAccuracy,
    opts.timeout,
    opts.maximumAge,
  ])

  // Watch position if requested
  useEffect(() => {
    if (!opts.watchOnMount || !state.supported) return

    requestLocation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    requestLocation,
  }
}

/**
 * Get a user-friendly error message from GeolocationPositionError
 */
export function getGeolocationErrorMessage(
  error: GeolocationPositionError | null,
): string {
  if (!error) return ''

  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access in your browser settings.'
    case error.POSITION_UNAVAILABLE:
      return 'Location unavailable. Please check your device settings.'
    case error.TIMEOUT:
      return 'Location request timed out. Please try again.'
    default:
      return error.message || 'Unable to get your location.'
  }
}
