// Marketplace section: wide landscape photo beside a typographic list of capabilities.
import { Link } from '@tanstack/react-router'
import { useI18n } from '../../../lib/i18n/provider'
import { DEFAULT_SELECT_LOCATION_SEARCH } from '../../../lib/navigationSearch'
import { staticAssets } from '../../../lib/staticAssets'
import { Reveal } from './-Reveal'

const RATING_SEARCH = {
  ...DEFAULT_SELECT_LOCATION_SEARCH,
  sort: 'rating' as const,
}

export function Marketplace() {
  const { t } = useI18n()

  const points = [
    {
      title: t('landing.marketplacePoint1Title'),
      desc: t('landing.marketplacePoint1Desc'),
      search: DEFAULT_SELECT_LOCATION_SEARCH,
    },
    {
      title: t('landing.marketplacePoint2Title'),
      desc: t('landing.marketplacePoint2Desc'),
      search: RATING_SEARCH,
    },
    {
      title: t('landing.marketplacePoint3Title'),
      desc: t('landing.marketplacePoint3Desc'),
      search: DEFAULT_SELECT_LOCATION_SEARCH,
    },
  ]

  return (
    <section className="mx-auto w-full max-w-[1400px] px-6 py-16 sm:px-10 lg:py-24">
      <Reveal className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-violet-600 uppercase sm:text-base dark:text-violet-400">
          {t('landing.marketplaceKicker')}
        </p>
        <h2 className="mt-4 text-3xl leading-[1.08] font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-slate-100 [font-family:var(--font-heading)]">
          {t('landing.marketplaceTitle')}
        </h2>
        <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
          {t('landing.marketplaceDesc')}
        </p>
      </Reveal>

      <div className="mt-12 grid items-start gap-12 lg:mt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <Reveal>
          <figure>
            <div className="overflow-hidden rounded-2xl">
              <img
                src={staticAssets.trifwaysLakesideHotel}
                alt="Lakeside hotel at dusk"
                width={760}
                height={428}
                loading="lazy"
                decoding="async"
                className="aspect-16/9 w-full object-cover"
              />
            </div>
            <figcaption className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">
                {t('landing.browserPreviewTitle')}
              </p>
              <p className="mt-1 text-sm text-slate-500 sm:text-base dark:text-slate-400">
                {t('landing.browserPreviewDesc')}
              </p>
            </figcaption>
          </figure>
        </Reveal>

        <Reveal delay={0.12}>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {points.map((point) => (
              <li key={point.title}>
                <Link
                  to="/select-location"
                  search={point.search}
                  className="group block py-6 first:pt-0"
                >
                  <h3 className="text-lg font-bold tracking-tight text-slate-900 transition-colors duration-200 group-hover:text-violet-600 sm:text-xl dark:text-slate-100 dark:group-hover:text-violet-400">
                    {point.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
                    {point.desc}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
