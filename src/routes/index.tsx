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
      <section className="landing-hero relative min-h-screen flex items-center">
        {/* Animated gradient background — replaces the old photo overlay */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Primary ambient orb */}
          <div
            className="landing-orb-1 absolute w-[900px] h-[900px] rounded-full blur-[160px] opacity-[0.07]"
            style={{
              background:
                'radial-gradient(circle, rgb(139 92 246), rgb(79 70 229))',
              top: '-20%',
              right: '-10%',
              animation: 'orbFloat1 20s ease-in-out infinite',
            }}
          />
          {/* Secondary ambient orb */}
          <div
            className="landing-orb-2 absolute w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.05]"
            style={{
              background:
                'radial-gradient(circle, rgb(124 58 237), rgb(99 102 241))',
              bottom: '-10%',
              left: '10%',
              animation: 'orbFloat2 25s ease-in-out infinite',
            }}
          />
          {/* Tertiary accent orb */}
          <div
            className="absolute w-[400px] h-[400px] rounded-full blur-[120px] opacity-[0.04]"
            style={{
              background:
                'radial-gradient(circle, rgb(167 139 250), rgb(139 92 246))',
              top: '40%',
              left: '40%',
              animation: 'orbFloat3 18s ease-in-out infinite',
            }}
          />
          {/* Subtle dot grid texture */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgb(148 163 184) 1px, transparent 0)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-20 lg:py-28">
          <div className="grid items-center gap-14 lg:gap-16 lg:grid-cols-[1fr_1fr]">
            {/* Left content */}
            <div className="space-y-7">
              {/* Premium badge with elegant styling */}
              <div
                className="landing-badge inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/8 backdrop-blur-md px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-violet-300"
                style={{ animation: 'fadeSlideUp 0.7s ease-out both' }}
              >
                <Sparkles size={13} className="text-violet-400" />
                <span>{t('landing.premiumBadge')}</span>
              </div>

              {/* Hero title with refined typography */}
              <h1
                className="landing-title text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-[-0.025em]"
                style={{ animation: 'fadeSlideUp 0.7s ease-out 0.12s both' }}
              >
                <span className="block text-slate-50">
                  {t('landing.titleLine1')}
                </span>
                <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-violet-400 to-indigo-400">
                  {t('landing.titleLine2')}
                </span>
              </h1>

              {/* Subtitle with better readability */}
              <p
                className="landing-subtitle max-w-lg text-lg sm:text-xl text-slate-400 leading-relaxed font-light"
                style={{ animation: 'fadeSlideUp 0.7s ease-out 0.24s both' }}
              >
                {t('landing.subtitle')}
              </p>

              {/* CTA buttons with elevated design */}
              <div
                className="flex flex-col sm:flex-row items-start gap-3 pt-1"
                style={{ animation: 'fadeSlideUp 0.7s ease-out 0.36s both' }}
              >
                <Link
                  to="/select-location"
                  search={DEFAULT_SELECT_LOCATION_SEARCH}
                  className="landing-primary-cta group inline-flex items-center gap-2.5 rounded-2xl bg-violet-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-violet-600/20 transition-all duration-300 hover:bg-violet-500 hover:shadow-violet-500/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <MapPin size={18} />
                  <span>{t('landing.browseHotels')}</span>
                  <ArrowRight
                    size={18}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Link>
                <Link
                  to="/sign-up"
                  search={DEFAULT_AUTH_SEARCH}
                  className="landing-secondary-cta inline-flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/40 backdrop-blur-sm px-7 py-3.5 font-semibold text-slate-200 transition-all duration-300 hover:border-slate-600 hover:bg-slate-800/50 hover:text-white cursor-pointer"
                >
                  {t('landing.createFreeAccount')}
                </Link>
              </div>

              {/* Trust indicators with subtle design */}
              <div
                className="flex flex-wrap gap-2.5 pt-3"
                style={{ animation: 'fadeSlideUp 0.7s ease-out 0.48s both' }}
              >
                {[
                  t('landing.pill1'),
                  t('landing.pill2'),
                  t('landing.pill3'),
                ].map((value, index) => (
                  <div
                    key={value}
                    className="landing-pill flex items-center gap-1.5 rounded-full border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm px-3.5 py-1.5 text-xs text-slate-400"
                    style={{
                      animation: `fadeSlideUp 0.5s ease-out ${0.55 + index * 0.08}s both`,
                    }}
                  >
                    <CheckCircle2
                      size={12}
                      className="text-violet-400/80 flex-shrink-0"
                    />
                    <span>{value}</span>
                  </div>
                ))}
              </div>

              {/* Sign in link */}
              <div
                style={{ animation: 'fadeSlideUp 0.5s ease-out 0.65s both' }}
              >
                <Link
                  to="/sign-in"
                  search={DEFAULT_AUTH_SEARCH}
                  className="landing-signin-link group inline-flex items-center gap-1.5 text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <span>{t('landing.alreadyHaveAccount')}</span>
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            </div>

            {/* Right side — Cascading image gallery */}
            <div
              className="relative hidden lg:block"
              style={{ animation: 'fadeSlideUp 0.9s ease-out 0.2s both' }}
            >
              <div className="relative w-full h-[600px]">
                {/* Background glow behind the gallery */}
                <div
                  className="absolute inset-0 rounded-full blur-[100px] opacity-[0.08]"
                  style={{
                    background:
                      'radial-gradient(ellipse at center, rgb(139 92 246), transparent 70%)',
                  }}
                />

                {/* Card 1 — Main / largest — Infinity pool */}
                <div
                  className="landing-gallery-card absolute z-30 rounded-[1.5rem] overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40"
                  style={{
                    width: '340px',
                    height: '420px',
                    top: '12%',
                    left: '8%',
                    animation:
                      'galleryFloat1 8s ease-in-out infinite, fadeSlideUp 0.8s ease-out 0.3s both',
                  }}
                >
                  <img
                    src="/assets/infinity-pool.webp"
                    alt="Luxury infinity pool overlooking mountains at sunset"
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                  {/* Bottom gradient overlay with label */}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5">
                    <p className="text-white/90 text-sm font-semibold">
                      Infinity Pool Suite
                    </p>
                    <p className="text-white/50 text-xs mt-0.5">
                      Mountain & ocean views
                    </p>
                  </div>
                  {/* Glassmorphism shine on top edge */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>

                {/* Card 2 — Upper right — Hotel lobby */}
                <div
                  className="landing-gallery-card absolute z-20 rounded-[1.25rem] overflow-hidden border border-white/[0.06] shadow-xl shadow-black/30"
                  style={{
                    width: '260px',
                    height: '180px',
                    top: '0%',
                    right: '0%',
                    animation:
                      'galleryFloat2 9s ease-in-out infinite, fadeSlideUp 0.8s ease-out 0.45s both',
                  }}
                >
                  <img
                    src="/assets/hotel-lobby.webp"
                    alt="Luxurious hotel lobby with elegant chandeliers"
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <p className="text-white/85 text-xs font-semibold">
                      Grand Lobby
                    </p>
                  </div>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                </div>

                {/* Card 3 — Lower right — Boutique room */}
                <div
                  className="landing-gallery-card absolute z-20 rounded-[1.25rem] overflow-hidden border border-white/[0.06] shadow-xl shadow-black/30"
                  style={{
                    width: '280px',
                    height: '200px',
                    bottom: '5%',
                    right: '-2%',
                    animation:
                      'galleryFloat3 10s ease-in-out infinite, fadeSlideUp 0.8s ease-out 0.55s both',
                  }}
                >
                  <img
                    src="/assets/boutique-room.webp"
                    alt="Cozy boutique hotel room with mountain views"
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <p className="text-white/85 text-xs font-semibold">
                      Boutique Room
                    </p>
                  </div>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                </div>

                {/* Floating stat badge — top left */}
                <div
                  className="landing-stat-badge absolute z-40 rounded-2xl border border-violet-500/20 bg-slate-900/80 backdrop-blur-xl px-4 py-3 shadow-lg shadow-black/30"
                  style={{
                    top: '-2%',
                    left: '-4%',
                    animation:
                      'galleryFloat2 7s ease-in-out infinite, fadeSlideUp 0.6s ease-out 0.7s both',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                      <Star size={14} className="text-violet-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">4.9</p>
                      <p className="text-slate-500 text-[10px]">Avg. Rating</p>
                    </div>
                  </div>
                </div>

                {/* Floating stat badge — bottom left */}
                <div
                  className="landing-stat-badge absolute z-40 rounded-2xl border border-emerald-500/20 bg-slate-900/80 backdrop-blur-xl px-4 py-3 shadow-lg shadow-black/30"
                  style={{
                    bottom: '12%',
                    left: '-8%',
                    animation:
                      'galleryFloat3 8s ease-in-out infinite, fadeSlideUp 0.6s ease-out 0.8s both',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                      <CheckCircle2
                        size={14}
                        className="text-emerald-400"
                      />
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">
                        Verified
                      </p>
                      <p className="text-slate-500 text-[10px]">
                        All listings
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Steps row — visible below on mobile, inline on desktop */}
          <div
            className="mt-16 lg:mt-20 grid gap-4 sm:grid-cols-2"
            style={{ animation: 'fadeSlideUp 0.7s ease-out 0.6s both' }}
          >
            <div className="landing-step-card group flex gap-4 rounded-2xl border border-slate-800/40 bg-slate-900/30 backdrop-blur-sm p-5 transition-all duration-300 hover:border-violet-500/20 hover:bg-slate-900/50">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-bold group-hover:bg-violet-500/15 transition-colors">
                1
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                  {t('landing.pickDestination')}
                </p>
                <p className="mt-1 text-slate-500 text-xs leading-relaxed">
                  {t('landing.pickDestinationDesc')}
                </p>
              </div>
            </div>
            <div className="landing-step-card group flex gap-4 rounded-2xl border border-slate-800/40 bg-slate-900/30 backdrop-blur-sm p-5 transition-all duration-300 hover:border-violet-500/20 hover:bg-slate-900/50">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-bold group-hover:bg-violet-500/15 transition-colors">
                2
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                  {t('landing.reserveConfidence')}
                </p>
                <p className="mt-1 text-slate-500 text-xs leading-relaxed">
                  {t('landing.reserveConfidenceDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product highlights with refined cards */}
      <section className="landing-features-section relative border-t border-slate-800/40 bg-slate-950 py-18 lg:py-24">
        {/* Subtle background accent */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_50%_0%,rgba(124,58,237,0.06),transparent_70%)]" />

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Section header */}
          <div className="max-w-xl mb-12">
            <div className="flex items-center gap-2 mb-3">
              <Star size={14} className="text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-400">
                Features
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
              {t('landing.whyChoose')}
            </h2>
          </div>

          {/* Feature cards */}
          <div className="grid gap-5 md:grid-cols-3">
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
                className="landing-feature-card group relative rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6 transition-all duration-500 hover:border-violet-500/25 hover:bg-slate-900/50 hover:shadow-lg hover:shadow-violet-500/5"
                style={{
                  animation: `fadeSlideUp 0.6s ease-out ${0.1 + index * 0.1}s both`,
                }}
              >
                {/* Icon */}
                <div className="mb-4 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/15 group-hover:border-violet-500/30 transition-colors">
                  <feature.icon
                    className="text-violet-400 group-hover:text-violet-300 transition-colors"
                    size={20}
                  />
                </div>
                <h3 className="text-base font-semibold text-slate-100 mb-2 group-hover:text-white transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed group-hover:text-slate-400 transition-colors">
                  {feature.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Refined footer */}
      <footer className="landing-footer relative border-t border-slate-800/30 py-10 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center h-9">
              <img
                src="/logo.webp"
                alt="TripWays Hotels"
                className="h-full w-auto object-contain opacity-70 hover:opacity-90 transition-opacity"
              />
            </div>
            <p className="landing-copyright text-xs text-slate-600">
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
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.05); }
          66% { transform: translate(20px, -20px) scale(0.97); }
        }

        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(30px, -40px) scale(1.03); }
          70% { transform: translate(-20px, 20px) scale(0.98); }
        }

        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, -25px) scale(1.04); }
        }

        @keyframes galleryFloat1 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        @keyframes galleryFloat2 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes galleryFloat3 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}
