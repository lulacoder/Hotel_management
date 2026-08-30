// Closing band: type-led call to action with no bordered container.
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '../../../lib/i18n/provider'
import {
  DEFAULT_AUTH_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../../../lib/navigationSearch'
import { Reveal } from './-Reveal'
import { Button } from '@/components/ui/button'

export function ClosingCta() {
  const { t } = useI18n()

  return (
    <section className="bg-slate-50 dark:bg-slate-900/40">
      <div className="mx-auto w-full max-w-[1400px] px-6 py-20 sm:px-10 lg:py-28">
        <Reveal className="max-w-3xl">
          <h2 className="text-3xl leading-[1.08] font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-slate-100 [font-family:var(--font-heading)]">
            {t('landing.finalTitle')}
          </h2>
          <div className="mt-9 flex flex-wrap items-center gap-3">
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
              <Link to="/sign-in" search={DEFAULT_AUTH_SEARCH}>
                {t('landing.alreadyHaveAccount')}
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
