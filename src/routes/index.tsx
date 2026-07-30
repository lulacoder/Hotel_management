// Public landing page route with entry actions for browsing or authentication.
import { useAuth } from '@clerk/clerk-react'
import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useI18n } from '../lib/i18n/provider'
import { CURRENT_YEAR } from '../lib/currentYear'
import { DEFAULT_AUTH_SEARCH } from '../lib/navigationSearch'
import { staticAssets } from '../lib/staticAssets'
import { Hero } from './index/components/-Hero'
import { CapabilityIndex } from './index/components/-CapabilityIndex'
import { Marketplace } from './index/components/-Marketplace'
import { StayMoods } from './index/components/-StayMoods'
import { BookingPath } from './index/components/-BookingPath'
import { ClosingCta } from './index/components/-ClosingCta'

export const Route = createFileRoute('/')({
  // Route definition for public landing experience.
  // Public marketing/entry page.
  component: LandingPage,
})

function LandingPage() {
  // Resolve auth state first to avoid showing guest CTA to signed-in users.
  const { isSignedIn, isLoaded } = useAuth()
  const { t } = useI18n()

  // Signed-in users should continue through role-aware post-login routing
  // instead of sitting on a passive loading screen.
  if (isLoaded && isSignedIn) {
    return <Navigate to="/post-login" search={DEFAULT_AUTH_SEARCH} replace />
  }

  return (
    <div className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 [font-family:var(--font-body)]">
      <Hero />
      <CapabilityIndex />
      <Marketplace />
      <StayMoods />
      <BookingPath />
      <ClosingCta />

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row sm:px-10">
          <img
            src={staticAssets.logo}
            alt="TripWays Hotels"
            className="h-8 w-auto opacity-90"
          />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            &copy; {CURRENT_YEAR} TripWays Hotels.{' '}
            {t('common.allRightsReserved')}
          </p>
        </div>
      </footer>
    </div>
  )
}
