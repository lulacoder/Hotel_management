// Public landing page route with entry actions for browsing or authentication.
import { useAuth } from '@clerk/clerk-react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import { useI18n } from '../lib/i18n'
import {
  DEFAULT_AUTH_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../lib/navigationSearch'

export const Route = createFileRoute('/')({
  // Route definition for public landing experience.
  // Public marketing/entry page.
  component: LandingPage,
})

function LandingPage() {
  // Resolve auth state first to avoid showing guest CTA to signed-in users.
  const { isSignedIn, isLoaded } = useAuth()
  const { t } = useI18n()

  // Signed-in users should continue to role-aware post-login routing.
  if (isLoaded && isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="relative mx-auto mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-violet-500/20 border-t-violet-500"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-violet-500/10"></div>
          </div>
          <p className="text-slate-400 mb-2">{t('landing.redirecting')}</p>
          <Link
            to="/post-login"
            search={DEFAULT_AUTH_SEARCH}
            className="text-violet-400 hover:text-violet-300 text-sm transition-colors"
          >
            {t('landing.clickIfNotRedirected')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="landing-page min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Hero section with primary actions */}
      <section className="landing-hero relative min-h-[92vh] flex items-center">
        {/* Atmospheric background layers */}
        <div className="absolute inset-0">
          {/* Primary gradient orbs */}
          <div className="landing-hero-bg absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_-10%,rgba(124,58,237,0.25),transparent_50%),radial-gradient(ellipse_60%_40%_at_80%_10%,rgba(99,102,241,0.2),transparent_45%),radial-gradient(ellipse_50%_30%_at_50%_80%,rgba(124,58,237,0.12),transparent_50%)]" />
          {/* Subtle noise texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
          {/* Elegant grid pattern */}
          <div
            className="landing-hero-grid absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)',
              backgroundSize: '100px 100px',
            }}
          />
          {/* Floating accent shapes */}
          <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute bottom-1/3 left-1/5 w-96 h-96 bg-indigo-500/8 rounded-full blur-3xl"
            style={{ animationDelay: '2s' }}
          />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16 lg:py-24">
          <div className="grid items-center gap-16 lg:gap-20 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Left content */}
            <div className="space-y-8">
              {/* Premium badge with elegant styling */}
              <div
                className="landing-badge inline-flex items-center gap-2.5 rounded-full border border-violet-400/30 bg-violet-500/10 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-violet-300 shadow-lg shadow-violet-500/10"
                style={{ animation: 'fadeSlideUp 0.6s ease-out' }}
              >
                <Sparkles size={15} className="text-violet-400" />
                <span className="tracking-wide">
                  {t('landing.premiumBadge')}
                </span>
              </div>

              {/* Hero title with refined typography */}
              <h1
                className="landing-title text-[3.25rem] sm:text-6xl lg:text-[4.5rem] font-bold leading-[1.05] tracking-[-0.02em]"
                style={{ animation: 'fadeSlideUp 0.6s ease-out 0.1s both' }}
              >
                <span className="block text-slate-50">
                  {t('landing.titleLine1')}
                </span>
                <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-violet-400 to-indigo-400">
                  {t('landing.titleLine2')}
                </span>
              </h1>

              {/* Subtitle with better readability */}
              <p
                className="landing-subtitle max-w-xl text-lg sm:text-xl text-slate-400 leading-relaxed font-light"
                style={{ animation: 'fadeSlideUp 0.6s ease-out 0.2s both' }}
              >
                {t('landing.subtitle')}
              </p>

              {/* CTA buttons with elevated design */}
              <div
                className="flex flex-col sm:flex-row items-start gap-4 pt-2"
                style={{ animation: 'fadeSlideUp 0.6s ease-out 0.3s both' }}
              >
                <Link
                  to="/select-location"
                  search={DEFAULT_SELECT_LOCATION_SEARCH}
                  className="landing-primary-cta group relative inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 via-violet-600 to-indigo-600 px-8 py-4 font-semibold text-white shadow-xl shadow-violet-500/30 transition-all duration-300 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-violet-400 via-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <MapPin size={20} className="relative z-10" />
                  <span className="relative z-10">
                    {t('landing.browseHotels')}
                  </span>
                  <ArrowRight
                    size={20}
                    className="relative z-10 transition-transform group-hover:translate-x-1"
                  />
                </Link>
                <Link
                  to="/sign-up"
                  search={DEFAULT_AUTH_SEARCH}
                  className="landing-secondary-cta inline-flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/50 backdrop-blur-sm px-8 py-4 font-semibold text-slate-200 transition-all duration-300 hover:border-slate-600 hover:bg-slate-800/60 hover:text-white"
                >
                  {t('landing.createFreeAccount')}
                </Link>
              </div>

              {/* Trust indicators with subtle design */}
              <div
                className="flex flex-wrap gap-3 pt-4"
                style={{ animation: 'fadeSlideUp 0.6s ease-out 0.4s both' }}
              >
                {[
                  t('landing.pill1'),
                  t('landing.pill2'),
                  t('landing.pill3'),
                ].map((value, index) => (
                  <div
                    key={value}
                    className="landing-pill flex items-center gap-2 rounded-full border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm px-4 py-2 text-sm text-slate-400"
                    style={{
                      animation: `fadeSlideUp 0.5s ease-out ${0.5 + index * 0.1}s both`,
                    }}
                  >
                    <CheckCircle2
                      size={14}
                      className="text-violet-400 flex-shrink-0"
                    />
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side - Refined info card */}
            <div
              className="lg:pl-4"
              style={{ animation: 'fadeSlideUp 0.7s ease-out 0.3s both' }}
            >
              <div className="landing-info-card relative rounded-3xl border border-violet-500/20 bg-gradient-to-b from-slate-900/80 to-slate-900/60 p-8 shadow-2xl shadow-violet-500/20 backdrop-blur-xl">
                {/* Decorative corner accent */}
                <div className="absolute -top-px -right-px w-24 h-24 bg-gradient-to-bl from-violet-500/20 to-transparent rounded-tr-3xl" />
                <div className="absolute -bottom-px -left-px w-32 h-32 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-bl-3xl" />

                {/* Logo container with proper sizing */}
                <div className="relative flex items-center gap-4 pb-6 border-b border-slate-800/60">
                  <div className="flex-shrink-0 h-14 w-auto flex items-center">
                    <img
                      src="/logo.png"
                      alt="TripWays Hotels"
                      className="h-full w-auto object-contain"
                    />
                  </div>
                </div>

                {/* Info items with numbered steps */}
                <div className="mt-7 space-y-4">
                  <div className="landing-info-item group flex gap-4 rounded-2xl border border-slate-800/50 bg-slate-950/50 p-5 transition-all duration-300 hover:border-violet-500/30 hover:bg-slate-950/70">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 text-sm font-semibold">
                      1
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                        {t('landing.pickDestination')}
                      </p>
                      <p className="mt-1.5 text-slate-500 text-sm leading-relaxed">
                        {t('landing.pickDestinationDesc')}
                      </p>
                    </div>
                  </div>
                  <div className="landing-info-item group flex gap-4 rounded-2xl border border-slate-800/50 bg-slate-950/50 p-5 transition-all duration-300 hover:border-violet-500/30 hover:bg-slate-950/70">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 text-sm font-semibold">
                      2
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                        {t('landing.reserveConfidence')}
                      </p>
                      <p className="mt-1.5 text-slate-500 text-sm leading-relaxed">
                        {t('landing.reserveConfidenceDesc')}
                      </p>
                    </div>
                  </div>

                  {/* Sign in link with refined styling */}
                  <div className="pt-3">
                    <Link
                      to="/sign-in"
                      search={DEFAULT_AUTH_SEARCH}
                      className="landing-signin-link group inline-flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <span>{t('landing.alreadyHaveAccount')}</span>
                      <ArrowRight
                        size={15}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product highlights with refined cards */}
      <section className="landing-features-section relative border-t border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950 py-20 lg:py-28">
        {/* Subtle background accent */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(124,58,237,0.08),transparent_70%)]" />

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Section header with elegant typography */}
          <div className="max-w-2xl mb-14">
            <div className="flex items-center gap-2 mb-4">
              <Star size={16} className="text-violet-400" />
              <span className="text-sm font-medium text-violet-400 tracking-wide uppercase">
                Features
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-100">
              {t('landing.whyChoose')}
            </h2>
          </div>

          {/* Feature cards with hover interactions */}
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Compass,
                title: t('landing.featureDiscoveryTitle'),
                desc: t('landing.featureDiscoveryDesc'),
              },
              {
                icon: ShieldCheck,
                title: t('landing.featureReliableTitle'),
                desc: t('landing.featureReliableDesc'),
              },
              {
                icon: MapPin,
                title: t('landing.featureTravelTitle'),
                desc: t('landing.featureTravelDesc'),
              },
            ].map((feature, index) => (
              <article
                key={feature.title}
                className="landing-feature-card group relative rounded-2xl border border-slate-800/60 bg-slate-900/40 p-7 transition-all duration-500 hover:border-violet-500/30 hover:bg-slate-900/60 hover:shadow-xl hover:shadow-violet-500/10"
                style={{
                  animation: `fadeSlideUp 0.5s ease-out ${0.1 + index * 0.1}s both`,
                }}
              >
                {/* Icon with gradient background */}
                <div className="mb-5 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border border-violet-500/20 group-hover:border-violet-500/40 transition-colors">
                  <feature.icon
                    className="text-violet-400 group-hover:text-violet-300 transition-colors"
                    size={22}
                  />
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-3 group-hover:text-white transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">
                  {feature.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Refined footer */}
      <footer className="landing-footer relative border-t border-slate-800/40 py-12 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Logo with proper sizing */}
            <div className="flex items-center h-10">
              <img
                src="/logo.png"
                alt="TripWays Hotels"
                className="h-full w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
            <p className="landing-copyright text-sm text-slate-500">
              &copy; {new Date().getFullYear()} TripWays Hotels.{' '}
              {t('common.allRightsReserved')}
            </p>
          </div>
        </div>
      </footer>

      {/* CSS animations */}
      <style>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
