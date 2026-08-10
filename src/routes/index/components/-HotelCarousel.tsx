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
    <article className="group relative w-[78vw] max-w-[360px] shrink-0 overflow-hidden rounded-[1.75rem] bg-slate-900 shadow-[0_28px_70px_-35px_rgba(15,23,42,0.8)] ring-1 ring-slate-900/10 sm:w-[360px] dark:ring-white/10">
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
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
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

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              {hotel.category && (
                <p className="mb-1 text-[0.65rem] font-bold tracking-[0.18em] text-violet-200 uppercase">
                  {hotel.category}
                </p>
              )}
              <h3 className="truncate text-xl font-bold tracking-tight text-white [font-family:var(--font-heading)]">
                {hotel.name}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-300">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {hotel.city}, {hotel.country}
                </span>
              </p>
            </div>

            {rating !== undefined && (
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-black/35 px-2.5 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                <Star
                  className="size-3.5 fill-amber-300 text-amber-300"
                  aria-hidden
                />
                {rating.toFixed(1)}
              </div>
            )}
          </div>

          <Link
            to="/hotels/$hotelId"
            params={{ hotelId: hotel._id }}
            search={DEFAULT_HOTEL_DETAIL_SEARCH}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 transition-all duration-200 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
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
  const prefersReducedMotion = useReducedMotion()
  const carouselPlugins = useMemo(
    () => [
      AutoScroll({
        playOnInit: !prefersReducedMotion,
        speed: 0.6,
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
      containScroll: false,
      dragFree: true,
      loop: true,
    },
    carouselPlugins,
  )

  const featuredHotels = hotels
    ? [...hotels]
        .sort(
          (left, right) =>
            Number(Boolean(right.imageUrl)) - Number(Boolean(left.imageUrl)),
        )
        .slice(0, 12)
    : []
  const minimumCards = 5
  const carouselHotels = featuredHotels.length
    ? Array.from(
        {
          length: Math.max(
            1,
            Math.ceil(minimumCards / featuredHotels.length),
          ),
        },
        () => featuredHotels,
      ).flat()
    : []

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
          <p className="text-xs font-bold tracking-[0.2em] text-violet-600 uppercase dark:text-violet-400">
            {t('landing.hotelCarouselKicker')}
          </p>
          <h2
            id="featured-hotels-title"
            className="mt-3 text-3xl leading-[1.08] font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white [font-family:var(--font-heading)]"
          >
            {t('landing.hotelCarouselTitle')}
          </h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
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
            onMouseLeave={(event) => {
              const viewport = event.currentTarget
              window.setTimeout(() => {
                if (!viewport.matches(':hover')) {
                  carouselApi?.plugins().autoScroll.play(0)
                }
              }, 400)
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
            <div className="hotel-carousel-track flex w-max gap-5 px-2">
              {carouselHotels.map((hotel, index) => (
                <HotelCard key={`${hotel._id}-${index}`} hotel={hotel} />
              ))}
            </div>
          </div>
        </>
      )}

      {hotels !== undefined && (
        <div className="mx-auto mt-5 flex w-full max-w-[1400px] justify-end px-6 sm:px-10">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
            <ArrowLeftRight className="size-4" aria-hidden />
            {t('landing.hotelCarouselControls')}
          </p>
        </div>
      )}
    </section>
  )
}
