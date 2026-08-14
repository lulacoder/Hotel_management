// Landing hero: asymmetric split with copy on the left and a single portrait image.
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, MapPin, Search, Users } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../lib/i18n/provider'
import {
  DEFAULT_AUTH_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
  getMinimumCheckoutDate,
  getTodayDateString,
} from '../../../lib/navigationSearch'
import { Reveal } from './-Reveal'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { staticAssets } from '@/lib/staticAssets'

export function Hero() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [destination, setDestination] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(1)

  const today = getTodayDateString()
  const minCheckOut = getMinimumCheckoutDate(checkIn) ?? today

  const submitAvailabilitySearch = (event: React.FormEvent) => {
    event.preventDefault()
    if (!checkIn || !checkOut) return

    void navigate({
      to: '/select-location',
      search: {
        ...DEFAULT_SELECT_LOCATION_SEARCH,
        checkIn,
        checkOut,
        guests,
        q: destination.trim(),
      },
    })
  }

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

          <form
            onSubmit={submitAvailabilitySearch}
            className="mt-9 grid gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900/60"
          >
            <label className="relative sm:col-span-2">
              <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <span className="sr-only">{t('landing.searchWhere')}</span>
              <input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder={t('landing.searchWherePlaceholder')}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-violet-500 sm:text-base dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <DatePicker
              ariaLabel={t('landing.searchCheckIn')}
              placeholder={t('landing.searchCheckIn')}
              value={checkIn}
              min={today}
              onChange={(nextCheckIn) => {
                setCheckIn(nextCheckIn)

                const nextMinCheckOut = getMinimumCheckoutDate(nextCheckIn)
                if (nextMinCheckOut && (!checkOut || checkOut < nextMinCheckOut)) {
                  setCheckOut(nextMinCheckOut)
                }
              }}
              className="h-11 rounded-xl border-slate-200 py-0 dark:bg-slate-800"
            />
            <DatePicker
              ariaLabel={t('landing.searchCheckOut')}
              placeholder={t('landing.searchCheckOut')}
              value={checkOut}
              min={minCheckOut}
              onChange={(nextCheckOut) => {
                setCheckOut(
                  nextCheckOut && nextCheckOut < minCheckOut
                    ? minCheckOut
                    : nextCheckOut,
                )
              }}
              className="h-11 rounded-xl border-slate-200 py-0 dark:bg-slate-800"
            />
            <label className="relative">
              <Users className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <span className="sr-only">{t('landing.searchGuests')}</span>
              <input
                required
                type="number"
                min={1}
                max={20}
                value={guests}
                onChange={(event) => setGuests(Number(event.target.value))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-violet-500 sm:text-base dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <button
              type="submit"
              className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 sm:text-base"
            >
              <Search size={18} aria-hidden />
              {t('landing.searchAvailability')}
            </button>
          </form>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="group h-12 gap-2 rounded-xl bg-violet-600 px-7 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-violet-500 active:translate-y-0 sm:text-base"
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
              className="h-12 rounded-xl border-slate-300 px-7 text-sm font-semibold text-slate-900 transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white active:translate-y-0 sm:text-base dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-100 dark:hover:text-slate-900"
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
              <span className="text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">
                {t('landing.galleryPoolTitle')}
              </span>
              <span className="text-sm text-slate-500 sm:text-base dark:text-slate-400">
                {t('landing.galleryPoolDesc')}
              </span>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}
