import { Link } from '@tanstack/react-router'
import AutoScroll from 'embla-carousel-auto-scroll'
import useEmblaCarousel from 'embla-carousel-react'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { useReducedMotion } from 'motion/react'
import {
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  MapPin,
  Star,
} from 'lucide-react'
import { useMemo } from 'react'

import { api } from '../../../../convex/_generated/api'
import { getHotelCategoryLabel } from '../../../lib/hotelCategories'
import { useI18n } from '../../../lib/i18n/provider'
import { DEFAULT_HOTEL_DETAIL_SEARCH } from '../../../lib/navigationSearch'
import type { Doc } from '../../../../convex/_generated/dataModel'
import { useQuery } from '@/integrations/convex/hooks'

type Hotel = Doc<'hotels'> & { imageUrl?: string }

type HotelCardProps = {
  hotel: Hotel
}

function HotelCard({ hotel }: HotelCardProps) {
  const { t } = useI18n()
  const rating =
    hotel.ratingCount && hotel.ratingSum
      ? hotel.ratingSum / hotel.ratingCount
      : hotel.rating

  return (
    <article className="group relative w-[78vw] max-w-[360px] shrink-0 overflow-hidden rounded-[1.75rem] bg-slate-900 shadow-[0_28px_70px_-35px_rgba(15,23,42,0.8)] ring-1 ring-slate-900/10 transition-all duration-300 hover:ring-violet-500/40 sm:w-[360px] dark:ring-white/10">
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-800">
        {hotel.imageUrl ? (
          <img
            src={hotel.imageUrl}
            alt={t('landing.hotelImageAlt', { name: hotel.name })}
            width={720}
            height={900}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            draggable={false}
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_top,rgb(76_29_149),rgb(15_23_42)_65%)]">
            <Building2
              className="size-20 text-violet-200/45"
              strokeWidth={1.25}
              aria-hidden
            />
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-4 inset-x-4 flex items-start justify-between gap-2 z-10">
          {hotel.category ? (
            <span className="rounded-full border border-white/20 bg-slate-950/60 px-3 py-1 text-xs font-bold tracking-wider text-violet-200 uppercase backdrop-blur-md">
              {getHotelCategoryLabel(hotel.category, t)}
            </span>
          ) : <span />}

          {rating !== undefined && (
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-slate-950/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-md">
              <Star
                className="size-3.5 fill-amber-300 text-amber-300"
                aria-hidden
              />
              {rating.toFixed(1)}
            </div>
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 z-10">
          <div className="mb-4">
            <h3 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl [font-family:var(--font-heading)]">
              {hotel.name}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-300 sm:text-base">
              <MapPin className="size-4 shrink-0 text-violet-400" aria-hidden />
              <span className="truncate">
                {hotel.city}, {hotel.country}
              </span>
            </p>
          </div>

          <div className="mb-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-300">
            <div>
              <span className="text-[11px] text-slate-400 block uppercase tracking-wider">{t('landing.startingFrom')}</span>
              <span className="text-base font-bold text-white">$0.00 <span className="text-xs font-normal text-slate-400">{t('landing.perNight')}</span></span>
            </div>
            {hotel.parkingIncluded && (
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                {t('hotel.freeParking')}
              </span>
            )}
          </div>

          <Link
            to="/hotels/$hotelId"
            params={{ hotelId: hotel._id }}
            search={DEFAULT_HOTEL_DETAIL_SEARCH}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 shadow-md transition-all duration-200 hover:bg-violet-100 hover:shadow-violet-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98] sm:h-12 sm:text-base"
          >
            {t('landing.viewHotel')}
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  )
}

function CarouselSkeleton() {
  return (
    <div className="flex gap-5 overflow-hidden px-6 sm:px-10" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="aspect-[4/5] w-[78vw] max-w-[360px] shrink-0 animate-pulse rounded-[1.75rem] bg-slate-200 dark:bg-slate-800"
        />
      ))}
    </div>
  )
}

// Shows a continuously moving hotel collection that yields control while guests interact with it.
export function HotelCarousel() {
  const { t } = useI18n()
  const hotels = useQuery(api.hotels.list, {})
  const featuredHotels = useMemo(() => {
    if (!hotels) return []
    return [...hotels]
      .sort(
        (left, right) =>
          Number(Boolean(right.imageUrl)) - Number(Boolean(left.imageUrl)),
      )
      .slice(0, 12)
  }, [hotels])

  // Ensure sufficient cards (minimum 16 cards and at least 3 repetitions)
  // so Embla Carousel's loop engine can continuously cycle without ever hitting a boundary.
  const carouselHotels = useMemo(() => {
    if (!featuredHotels.length) return []
    const targetCount = Math.max(16, featuredHotels.length * 3)
    const repetitions = Math.max(
      3,
      Math.ceil(targetCount / featuredHotels.length),
    )
    return Array.from({ length: repetitions }, () => featuredHotels).flat()
  }, [featuredHotels])

  const prefersReducedMotion = useReducedMotion()

  const carouselPlugins = useMemo(
    () => [
      AutoScroll({
        playOnInit: !prefersReducedMotion,
        speed: 0.75,
        startDelay: 0,
        stopOnFocusIn: false,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
      WheelGesturesPlugin({ forceWheelAxis: 'x' }),
    ],
    [prefersReducedMotion],
  )

  const [carouselRef, carouselApi] = useEmblaCarousel(
    {
      align: 'start',
      dragFree: true,
      loop: true,
      skipSnaps: true,
    },
    carouselPlugins,
  )

  if (hotels?.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby="featured-hotels-title"
      className="border-y border-slate-200 bg-slate-50/80 py-16 dark:border-slate-800 dark:bg-slate-900/30 sm:py-20"
    >
      <div className="mx-auto mb-9 flex w-full max-w-[1400px] flex-col justify-between gap-4 px-6 sm:px-10 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="text-sm font-bold tracking-[0.2em] text-violet-600 uppercase sm:text-base dark:text-violet-400">
            {t('landing.hotelCarouselKicker')}
          </p>
          <h2
            id="featured-hotels-title"
            className="mt-3 text-3xl leading-[1.08] font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white [font-family:var(--font-heading)]"
          >
            {t('landing.hotelCarouselTitle')}
          </h2>
        </div>
        <p className="max-w-md text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
          {t('landing.hotelCarouselDescription')}
        </p>
      </div>

      {hotels === undefined ? (
        <CarouselSkeleton />
      ) : (
        <>
          <span className="sr-only">{t('landing.hotelCarouselControls')}</span>
          <div
            ref={carouselRef}
            className="hotel-carousel-mask hotel-carousel-viewport overflow-hidden"
            aria-label={t('landing.hotelCarouselLabel')}
            role="region"
            tabIndex={0}
            onMouseEnter={() => {
              const autoScroll = carouselApi?.plugins().autoScroll
              if (autoScroll?.isPlaying()) {
                autoScroll.stop()
              }
            }}
            onMouseLeave={() => {
              const autoScroll = carouselApi?.plugins().autoScroll
              if (autoScroll && !autoScroll.isPlaying()) {
                autoScroll.play()
              }
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
                return
              }

              event.preventDefault()
              if (event.key === 'ArrowLeft') {
                carouselApi?.scrollPrev()
              } else {
                carouselApi?.scrollNext()
              }
            }}
          >
            <div className="hotel-carousel-track flex touch-pan-y gap-5 px-2">
              {carouselHotels.map((hotel, index) => (
                <HotelCard key={`${hotel._id}-${index}`} hotel={hotel} />
              ))}
            </div>
          </div>
        </>
      )}

      {hotels !== undefined && (
        <div className="mx-auto mt-5 flex w-full max-w-[1400px] justify-end px-6 sm:px-10">
          <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500 sm:text-base dark:text-slate-400">
            <ArrowLeftRight className="size-4" aria-hidden />
            {t('landing.hotelCarouselControls')}
          </p>
        </div>
      )}
    </section>
  )
}
