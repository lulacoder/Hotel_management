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
    <article className="group relative w-[78vw] max-w-[360px] shrink-0 overflow-hidden rounded-[1.75rem] bg-slate-950 shadow-[0_28px_70px_-35px_rgba(15,23,42,0.85)] ring-1 ring-slate-800 transition-all duration-300 hover:ring-violet-500/50 sm:w-[360px]">
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-900">
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
          <div className="relative flex size-full flex-col items-center justify-center bg-gradient-to-b from-violet-950/80 via-slate-900 to-slate-950">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.35),transparent_70%)]" />
            <div className="relative mb-12 flex size-20 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/10 shadow-lg shadow-violet-950/50 backdrop-blur-sm transition-transform duration-500 group-hover:scale-105">
              <Building2
                className="size-10 text-violet-300"
                strokeWidth={1.5}
                aria-hidden
              />
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-4 inset-x-4 flex items-start justify-between gap-2 z-20">
          {hotel.category ? (
            <span className="rounded-full border border-white/20 bg-slate-950/80 px-3 py-1 text-xs font-bold tracking-wider text-violet-200 uppercase shadow-lg backdrop-blur-md">
              {getHotelCategoryLabel(hotel.category, t)}
            </span>
          ) : (
            <span />
          )}

          {rating !== undefined && (
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-white shadow-lg backdrop-blur-md">
              <Star
                className="size-3.5 fill-amber-400 text-amber-400"
                aria-hidden
              />
              {rating.toFixed(1)}
            </div>
          )}
        </div>

        {/* Multi-layer gradient scrim ensuring high contrast text regardless of image brightness */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 via-45% to-slate-950/20 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none" />

        {/* Bottom Details Content */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 z-10">
          <div className="mb-3">
            <h3 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl [font-family:var(--font-heading)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {hotel.name}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-slate-100 sm:text-base">
              <MapPin className="size-4 shrink-0 text-violet-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" aria-hidden />
              <span className="truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {hotel.city}, {hotel.country}
              </span>
            </p>
            {hotel.description && (
              <p className="mt-1.5 line-clamp-1 text-xs text-slate-200/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {hotel.description}
              </p>
            )}
          </div>

          <div className="mb-3 flex items-center justify-end border-t border-white/15 pt-2.5 text-xs">
            {hotel.parkingIncluded ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-950/85 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 shadow-sm backdrop-blur-sm">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                {t('hotel.freeParking')}
              </span>
            ) : (
              <span className="h-5" />
            )}
          </div>

          <Link
            to="/hotels/$hotelId"
            params={{ hotelId: hotel._id }}
            search={DEFAULT_HOTEL_DETAIL_SEARCH}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 shadow-lg shadow-black/40 transition-all duration-200 hover:bg-violet-100 hover:shadow-violet-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98] sm:h-12 sm:text-base"
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
