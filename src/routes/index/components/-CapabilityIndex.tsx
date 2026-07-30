// Four capabilities as hairline-topped numeral columns, no cards and no icons.
import { useI18n } from '../../../lib/i18n/provider'
import { Reveal } from './-Reveal'

export function CapabilityIndex() {
  const { t } = useI18n()

  const items = [
    {
      title: t('landing.featureHandpickedTitle'),
      desc: t('landing.featureHandpickedDesc'),
    },
    {
      title: t('landing.featureSecureTitle'),
      desc: t('landing.featureSecureDesc'),
    },
    {
      title: t('landing.featureFlexibleTitle'),
      desc: t('landing.featureFlexibleDesc'),
    },
    {
      title: t('landing.featureDealsTitle'),
      desc: t('landing.featureDealsDesc'),
    },
  ]

  return (
    <section className="mx-auto w-full max-w-[1400px] px-6 py-16 sm:px-10 lg:py-20">
      <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <Reveal key={item.title} delay={index * 0.07}>
            <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
              <span className="text-xs font-semibold tracking-[0.25em] text-slate-400 tabular-nums dark:text-slate-600">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {item.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
