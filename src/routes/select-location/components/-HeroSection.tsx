// Hero/intro section for the hotel discovery page with location status messaging.
import { Loader2, Navigation, Search } from 'lucide-react'

import { getGeolocationErrorMessage } from '../../../hooks/useGeolocation'
import { useI18n } from '../../../lib/i18n'
import type { ReactNode } from 'react'

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
  // Hero conveys search state and geolocation readiness to the user.
  const { t } = useI18n()
  const locationErrorMessage = locationError
    ? getGeolocationErrorMessage(locationError)
    : ''
  const locationErrorPreview =
    locationErrorMessage.length > 50
      ? `${locationErrorMessage.slice(0, 50)}...`
      : locationErrorMessage

  return (
    <div className="relative overflow-hidden px-4 py-8 md:py-10">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-purple-500/5"></div>
      <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">
              {t('select.findStay')}
            </h2>
            <p className="mt-1 text-sm text-slate-400 md:text-base">
              {t('select.findStaySubtitle')}
            </p>
          </div>

          {locationSupported &&
            (locationLoading ? (
              <div className="selector-location-loading inline-flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 md:text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('select.gettingLocation')}
              </div>
            ) : hasUserLocation ? (
              <div className="selector-location-enabled inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 md:text-sm">
                <Navigation className="w-4 h-4" />
                {t('select.locationEnabled')}
              </div>
            ) : locationError ? (
              <button
                type="button"
                onClick={requestLocation}
                title={locationErrorMessage}
                className="selector-location-retry inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700/50 md:text-sm"
              >
                <Navigation className="w-4 h-4" />
                {locationErrorPreview}
                <span className="selector-location-retry-link ml-1 text-violet-400">
                  {t('select.tryAgain')}
                </span>
              </button>
            ) : null)}
        </div>

        <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl border border-slate-800/50 bg-slate-900/50 p-3 md:p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={t('select.searchPlaceholder')}
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50 py-3 pl-12 pr-4 text-slate-200 placeholder-slate-500 transition-all focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
