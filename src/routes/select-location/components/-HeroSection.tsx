import { Loader2, Navigation, Search } from 'lucide-react'
import type { ReactNode } from 'react'

import { getGeolocationErrorMessage } from '../../../hooks/useGeolocation'

interface HeroSectionProps {
  locationSupported: boolean
  locationLoading: boolean
  hasUserLocation: boolean
  locationError: GeolocationPositionError | null
  requestLocation: () => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
  children: ReactNode
}

export function HeroSection({
  locationSupported,
  locationLoading,
  hasUserLocation,
  locationError,
  requestLocation,
  searchTerm,
  onSearchTermChange,
  children,
}: HeroSectionProps) {
  const locationErrorMessage = locationError
    ? getGeolocationErrorMessage(locationError)
    : ''
  const locationErrorPreview =
    locationErrorMessage.length > 50
      ? `${locationErrorMessage.slice(0, 50)}...`
      : locationErrorMessage

  return (
    <div className="relative py-16 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-violet-500/5"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl"></div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4 tracking-tight">
          Find Your Perfect Stay
        </h2>
        <p className="text-lg text-slate-400 mb-8">
          Browse our curated selection of hotels and book your next adventure.
        </p>

        {locationSupported && (
          <div className="mb-6">
            {locationLoading ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Getting your location...
              </div>
            ) : hasUserLocation ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
                <Navigation className="w-4 h-4" />
                Location enabled - showing hotels sorted by distance
              </div>
            ) : locationError ? (
              <button
                onClick={requestLocation}
                title={locationErrorMessage}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-slate-400 text-sm transition-colors"
              >
                <Navigation className="w-4 h-4" />
                {locationErrorPreview}
                <span className="text-amber-400 ml-1">Try again</span>
              </button>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-4 max-w-3xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search hotels, cities, or amenities..."
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
