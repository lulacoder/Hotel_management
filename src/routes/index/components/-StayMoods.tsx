// Stay moods: asymmetric photo grid with one tall image and two stacked, captions below.
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '../../../lib/i18n/provider'
import { DEFAULT_SELECT_LOCATION_SEARCH } from '../../../lib/navigationSearch'
import { staticAssets } from '../../../lib/staticAssets'
import { Reveal } from './-Reveal'

export function StayMoods() {
  const { t } = useI18n()

  const stays = [
    {
      image: staticAssets.mountainLodge,
      title: t('landing.stayPoolTitle'),
      desc: t('landing.stayPoolDesc'),
    },
    {
      image: staticAssets.rusticSuite,
      title: t('landing.stayBoutiqueTitle'),
      desc: t('landing.stayBoutiqueDesc'),
    },
    {
      image: staticAssets.adventureLodge,
      title: t('landing.stayServiceTitle'),
      desc: t('landing.stayServiceDesc'),
    },
  ]

  return (
    <section className="mx-auto w-full max-w-[1400px] px-6 py-16 sm:px-10 lg:py-24">
      <Reveal className="max-w-2xl">
        <h2 className="text-3xl leading-[1.08] font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-slate-100 [font-family:var(--font-heading)]">
          {t('landing.staysTitle')}
        </h2>
        <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
          {t('landing.staysDesc')}
        </p>
      </Reveal>

      <div className="mt-12 grid gap-6 md:grid-cols-2 md:grid-rows-2 lg:mt-16">
        {stays.map((stay, index) => (
          <Reveal
            key={stay.title}
            delay={index * 0.1}
            className={index === 0 ? 'md:row-span-2' : undefined}
          >
            <Link
              to="/select-location"
              search={DEFAULT_SELECT_LOCATION_SEARCH}
              className="group flex h-full flex-col"
            >
              <div className="overflow-hidden rounded-2xl">
                <img
                  src={stay.image}
                  alt={stay.title}
                  width={640}
                  height={index === 0 ? 800 : 400}
                  loading="lazy"
                  decoding="async"
                  className={`w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
                    index === 0 ? 'aspect-4/5' : 'aspect-16/10'
                  }`}
                />
              </div>
              <div className="mt-4 flex items-start justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <div>
                  <p className="text-base font-bold tracking-tight text-slate-900 transition-colors duration-200 group-hover:text-violet-600 dark:text-slate-100 dark:group-hover:text-violet-400">
                    {stay.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {stay.desc}
                  </p>
                </div>
                <ArrowRight
                  size={18}
                  aria-hidden
                  className="mt-1 shrink-0 text-slate-400 transition-transform duration-300 group-hover:translate-x-1 dark:text-slate-500"
                />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
