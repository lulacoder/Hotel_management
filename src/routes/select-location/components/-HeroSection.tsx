// Hero/intro section for the hotel discovery page with location status messaging.
import { Loader2, Navigation, Search } from 'lucide-react'

import { getGeolocationErrorMessage } from '../../../hooks/useGeolocation'
import { useI18n } from '../../../lib/i18n/provider'
import { useTheme } from '../../../lib/theme'
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const locationErrorMessage = locationError
    ? getGeolocationErrorMessage(locationError)
    : ''
  const locationErrorPreview =
    locationErrorMessage.length > 50
      ? `${locationErrorMessage.slice(0, 50)}...`
      : locationErrorMessage

  return (
    <div className="relative overflow-hidden px-4 py-6 sm:py-8 md:py-10">
      <img
        src="/assets/trifways-lakeside-hotel.webp"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full object-cover object-center"
      />
      <div
        className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-r from-slate-950/88 via-slate-950/62 to-slate-950/34'
            : 'bg-gradient-to-r from-white/90 via-white/62 to-white/18'
        }`}
      ></div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50 to-transparent dark:from-slate-950"></div>

      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:gap-3 md:mb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2
              className={`text-xl font-bold tracking-tight sm:text-2xl md:text-3xl ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {t('select.findStay')}
            </h2>
            <p
              className={`mt-0.5 text-xs sm:text-sm md:text-base ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {t('select.findStaySubtitle')}
            </p>
          </div>

          {locationSupported &&
            (locationLoading ? (
              <div className="selector-location-loading inline-flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 md:text-sm">
                <Loader2 className="size-4 animate-spin" />
                {t('select.gettingLocation')}
              </div>
            ) : hasUserLocation ? (
              <div className="selector-location-enabled inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 md:text-sm">
                <Navigation className="size-4" />
                {t('select.locationEnabled')}
              </div>
            ) : locationError ? (
              <button
                type="button"
                onClick={requestLocation}
                title={locationErrorMessage}
                className="selector-location-retry inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700/50 md:text-sm"
              >
                <Navigation className="size-4" />
                {locationErrorPreview}
                <span className="selector-location-retry-link ml-1 text-violet-400">
                  {t('select.tryAgain')}
                </span>
              </button>
            ) : null)}
        </div>

        <div
          className={`mx-auto flex max-w-4xl flex-col gap-2 sm:gap-3 rounded-2xl sm:rounded-[2rem] border p-2.5 sm:p-3 md:p-4 ${
            isDark
              ? 'border-slate-700/40 bg-slate-950/50 sm:bg-slate-950/72 shadow-[0_28px_54px_-34px_rgba(2,6,23,0.9)] backdrop-blur-md'
              : 'border-slate-200/70 sm:border-slate-200/95 bg-white/70 sm:bg-white/92 shadow-[0_30px_58px_-34px_rgba(15,23,42,0.36)] backdrop-blur-md'
          }`}
        >
          <div className="relative">
            <Search
              className={`absolute left-3 sm:left-4 top-1/2 size-4 sm:h-5 sm:w-5 -translate-y-1/2 ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            />
            <input
              aria-label={t('select.searchPlaceholder')}
              type="text"
              placeholder={t('select.searchPlaceholder')}
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              className={`w-full rounded-xl sm:rounded-[1.75rem] border py-2.5 sm:py-3 pl-10 sm:pl-12 pr-4 text-sm sm:text-base transition-all focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 ${
                isDark
                  ? 'border-slate-700/40 sm:border-slate-700/50 bg-slate-800/40 sm:bg-slate-800/50 text-slate-200 placeholder-slate-500'
                  : 'border-slate-300/70 sm:border-slate-300/90 bg-slate-50/70 sm:bg-slate-50/90 text-slate-800 placeholder-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] hover:border-violet-300'
              }`}
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
