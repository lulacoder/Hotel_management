// Public landing page route with entry actions for browsing or authentication.
import { useAuth } from '@clerk/clerk-react'
import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useI18n } from '../lib/i18n/provider'
import { DEFAULT_AUTH_SEARCH } from '../lib/navigationSearch'
import { staticAssets } from '../lib/staticAssets'
import { Seo } from '../components/Seo'
import { Footer } from '../components/Footer'
import { Hero } from './index/components/-Hero'
import { HotelCarousel } from './index/components/-HotelCarousel'
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

  // Structured schemas for Google rich search results
  const landingJsonLd = [
    {
      '@type': 'WebSite',
      name: 'TripWays Hotels',
      url: 'https://tripways.com',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://tripways.com/select-location?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      name: 'TripWays Hotels',
      url: 'https://tripways.com',
      logo: staticAssets.logo,
      description:
        'TripWays brings together handpicked luxury hotels, boutique rooms, and resort suites with seamless booking and instant confirmation.',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+251-11-000-0000',
        contactType: 'customer service',
        availableLanguage: ['English', 'Amharic'],
      },
    },
  ]

  // Signed-in users should continue through role-aware post-login routing
  // instead of sitting on a passive loading screen.
  if (isLoaded && isSignedIn) {
    return <Navigate to="/post-login" search={DEFAULT_AUTH_SEARCH} replace />
  }

  return (
    <div className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 [font-family:var(--font-body)]">
      <Seo
        title={t('landing.titleLine1') + ' ' + t('landing.titleLine2')}
        description={t('landing.subtitle')}
        canonicalUrl="/"
        jsonLd={landingJsonLd}
      />
      <Hero />
      <HotelCarousel />
      <CapabilityIndex />
      <Marketplace />
      <StayMoods />
      <BookingPath />
      <ClosingCta />
      <Footer />
    </div>
  )
}
