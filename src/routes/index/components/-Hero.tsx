// Landing hero: asymmetric split with copy on the left and a single portrait image.
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, MapPin, Search } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useI18n } from '../../../lib/i18n/provider'
import {
  DEFAULT_AUTH_SEARCH,
  DEFAULT_HOTEL_DETAIL_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
  getMinimumCheckoutDate,
  getTodayDateString,
} from '../../../lib/navigationSearch'
import { Reveal } from './-Reveal'
import { HeroSearchAutocomplete } from './-HeroSearchAutocomplete'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { GuestStepper } from '@/components/GuestStepper'
import { staticAssets } from '@/lib/staticAssets'

export function Hero() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [destination, setDestination] = useState('')
  const [selectedHotelId, setSelectedHotelId] = useState<Id<'hotels'> | null>(null)
  const [selectedHotelName, setSelectedHotelName] = useState<string | null>(null)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(1)
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Shared between the combobox input and the suggestion listbox for ARIA wiring.
  const listboxId = useId()

  const today = getTodayDateString()
  const minCheckOut = getMinimumCheckoutDate(checkIn) ?? today

  const submitAvailabilitySearch = (event: React.FormEvent) => {
    event.preventDefault()
    setIsAutocompleteOpen(false)

    if (selectedHotelId && destination.trim() === selectedHotelName?.trim()) {
      void navigate({
        to: '/hotels/$hotelId',
        params: { hotelId: selectedHotelId },
        search: {
          ...DEFAULT_HOTEL_DETAIL_SEARCH,
          checkIn: checkIn || undefined,
          checkOut: checkOut || undefined,
          guests: guests > 1 ? guests : undefined,
        },
      })
      return
    }

    void navigate({
      to: '/select-location',
      search: {
        ...DEFAULT_SELECT_LOCATION_SEARCH,
        checkIn: checkIn || '',
        checkOut: checkOut || '',
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
            <div className="relative sm:col-span-2">
              <label className="relative block">
                <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <span className="sr-only">{t('landing.searchWhere')}</span>
                <input
                  ref={inputRef}
                  value={destination}
                  onFocus={() => setIsAutocompleteOpen(true)}
                  onChange={(event) => {
                    const value = event.target.value
                    setDestination(value)
                    if (selectedHotelName && value !== selectedHotelName) {
                      setSelectedHotelId(null)
                      setSelectedHotelName(null)
                    }
                    setIsAutocompleteOpen(true)
                  }}
                  placeholder={t('landing.searchWherePlaceholder')}
                  role="combobox"
                  aria-expanded={isAutocompleteOpen}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  autoComplete="off"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-violet-500 sm:text-base dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              <HeroSearchAutocomplete
                searchTerm={destination}
                isOpen={isAutocompleteOpen}
                onClose={() => setIsAutocompleteOpen(false)}
                listboxId={listboxId}
                onSelectCity={(city) => {
                  setDestination(city)
                  setSelectedHotelId(null)
                  setSelectedHotelName(null)
                  setIsAutocompleteOpen(false)
                }}
                onSelectHotel={(hotel) => {
                  setDestination(hotel.name)
                  setSelectedHotelId(hotel.id)
                  setSelectedHotelName(hotel.name)
                  setIsAutocompleteOpen(false)
                }}
                onSelectViewAll={(query) => {
                  setDestination(query)
                  setSelectedHotelId(null)
                  setSelectedHotelName(null)
                  setIsAutocompleteOpen(false)
                }}
                inputRef={inputRef}
              />
            </div>
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
            <GuestStepper
              value={guests}
              onChange={setGuests}
              min={1}
              max={20}
              className="h-11 border-slate-200 py-0 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 sm:text-base"
            >
              <Search size={18} aria-hidden />
              {t('landing.searchAvailability')}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('landing.popularDestinationsLabel')}
            </span>
            {['Addis Ababa', 'Bishoftu', 'Hawassa', 'Bahir Dar'].map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => {
                  setDestination(city)
                  setSelectedHotelId(null)
                  setSelectedHotelName(null)
                }}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-violet-500/30 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
              >
                {city}
              </button>
            ))}
          </div>

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
              className="h-12 rounded-xl border border-slate-300 bg-white/80 px-7 text-sm font-semibold text-slate-800 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 hover:shadow-md hover:shadow-violet-500/10 active:translate-y-0 sm:text-base dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/30 dark:hover:text-violet-300 dark:hover:shadow-violet-950/20"
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
