// Booking path: oversized display numerals in a vertical sequence beside a tall image.
import { useI18n } from '../../../lib/i18n/provider'
import { staticAssets } from '../../../lib/staticAssets'
import { Reveal } from './-Reveal'

export function BookingPath() {
  const { t } = useI18n()

  const steps = [
    { title: t('landing.flowStep1Title'), desc: t('landing.flowStep1Desc') },
    { title: t('landing.flowStep2Title'), desc: t('landing.flowStep2Desc') },
    { title: t('landing.flowStep3Title'), desc: t('landing.flowStep3Desc') },
  ]

  return (
    <section className="mx-auto w-full max-w-[1400px] px-6 py-16 sm:px-10 lg:py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_0.72fr] lg:gap-20">
        <div>
          <Reveal className="max-w-2xl">
            <h2 className="text-3xl leading-[1.08] font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100 [font-family:var(--font-heading)]">
              {t('landing.flowTitle')}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
              {t('landing.flowDesc')}
            </p>
          </Reveal>

          <ol className="mt-12 space-y-10">
            {steps.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.1}>
                <li className="flex items-start gap-6 sm:gap-10">
                  <span
                    aria-hidden
                    className="text-5xl leading-none font-extrabold tracking-tighter text-slate-200 tabular-nums select-none sm:text-7xl dark:text-slate-800"
                  >
                    {index + 1}
                  </span>
                  <div className="pt-1">
                    <h3 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl dark:text-slate-100">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
                      {step.desc}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal delay={0.15} className="hidden lg:block">
          <div className="sticky top-28 overflow-hidden rounded-2xl">
            <img
              src={staticAssets.hotelLobby}
              alt="Hotel lobby with warm evening lighting"
              width={440}
              height={550}
              loading="lazy"
              decoding="async"
              className="aspect-4/5 w-full object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
