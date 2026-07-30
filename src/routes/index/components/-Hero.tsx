// Landing hero: asymmetric split with copy on the left and a single portrait image.
import { Link } from '@tanstack/react-router'
import { ArrowRight, Calendar, MapPin, Search, Users } from 'lucide-react'
import { useI18n } from '../../../lib/i18n/provider'
import {
  DEFAULT_AUTH_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../../../lib/navigationSearch'
import { Reveal } from './-Reveal'
import { Button } from '@/components/ui/button'
import { staticAssets } from '@/lib/staticAssets'

export function Hero() {
  const { t } = useI18n()

  const searchFields = [
    {
      icon: MapPin,
      label: t('landing.searchWhere'),
      value: t('landing.searchWherePlaceholder'),
    },
    {
      icon: Calendar,
      label: t('landing.searchCheckIn'),
      value: t('landing.searchDatesPlaceholder'),
    },
    {
      icon: Calendar,
      label: t('landing.searchCheckOut'),
      value: t('landing.searchDatesPlaceholder'),
    },
    {
      icon: Users,
      label: t('landing.searchGuests'),
      value: t('landing.searchGuestsPlaceholder'),
    },
  ]

  return (
    <section className="mx-auto w-full max-w-[1400px] px-6 pt-12 pb-20 sm:px-10 lg:pt-20 lg:pb-28">
      <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <Reveal>
          <h1 className="text-[2.75rem] leading-[1.02] font-extrabold tracking-tighter text-slate-900 sm:text-6xl lg:text-7xl dark:text-white [font-family:var(--font-heading)]">
            {t('landing.titleLine1')}
            <br />
            <span className="italic">{t('landing.titleLine2')}</span>
          </h1>

          <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
            {t('landing.subtitle')}
          </p>

          {/* Decorative preview of the search on /select-location. */}
          <div className="mt-9 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/70 p-2 sm:flex-row sm:items-stretch dark:border-slate-800 dark:bg-slate-900/50">
            <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-4 px-3 py-3">
              {searchFields.map((field) => (
                <div key={field.label} className="flex items-start gap-2.5">
                  <field.icon
                    size={15}
                    className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[0.7rem] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500">
                      {field.label}
                    </p>
                    <p className="truncate text-sm text-slate-800 dark:text-slate-300">
                      {field.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/select-location"
              search={DEFAULT_SELECT_LOCATION_SEARCH}
              aria-label={t('landing.browseHotels')}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-violet-500 active:scale-[0.98] sm:px-5 sm:py-0"
            >
              <Search size={18} aria-hidden />
              <span className="sm:hidden">{t('landing.browseHotels')}</span>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="group h-12 gap-2 rounded-xl bg-violet-600 px-7 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-violet-500 active:translate-y-0"
            >
              <Link
                to="/select-location"
                search={DEFAULT_SELECT_LOCATION_SEARCH}
              >
                {t('landing.browseHotels')}
                <ArrowRight
                  size={18}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-xl border-slate-300 px-7 text-sm font-semibold text-slate-900 transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white active:translate-y-0 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-100 dark:hover:text-slate-900"
            >
              <Link to="/sign-up" search={DEFAULT_AUTH_SEARCH}>
                {t('landing.createFreeAccount')}
              </Link>
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <figure className="mx-auto w-full max-w-[460px]">
            <div className="overflow-hidden rounded-2xl">
              <img
                src={staticAssets.infinityPool}
                alt="Infinity pool overlooking mountains at sunset"
                width={460}
                height={575}
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="aspect-4/5 w-full object-cover"
              />
            </div>
            <figcaption className="mt-4 flex items-baseline justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('landing.galleryPoolTitle')}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('landing.galleryPoolDesc')}
              </span>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}
