// Public landing page route with entry actions for browsing or authentication.
import { useAuth } from '@clerk/clerk-react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BedDouble,
  Building2,
  Calendar,
  CheckCircle2,
  Filter,
  Heart,
  LayoutGrid,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const ratingSearch = {
    ...DEFAULT_SELECT_LOCATION_SEARCH,
    sort: 'rating' as const,
  }

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
    <div className="landing-page landing-light-theme">
      {/* Hero section */}
      <section className="landing-hero-section">
        {/* Subtle background decorations */}
        <div className="landing-bg-decoration">
          <div className="landing-bg-dot-pattern" />
          <div className="landing-bg-glow landing-bg-glow--1" />
          <div className="landing-bg-glow landing-bg-glow--2" />
        </div>

        <div className="landing-hero-container">
          <div className="landing-hero-grid">
            {/* Left content */}
            <div className="landing-hero-left">
              {/* Premium badge */}
              <div
                className="landing-premium-badge"
                style={{ animation: 'landingFadeUp 0.7s ease-out both' }}
              >
                <Sparkles size={13} className="landing-badge-icon" />
                <span>{t('landing.premiumBadge')}</span>
              </div>

              {/* Hero title */}
              <h1
                className="landing-hero-title"
                style={{ animation: 'landingFadeUp 0.7s ease-out 0.12s both' }}
              >
                <span className="landing-title-line1">
                  {t('landing.titleLine1')}
                </span>
                <span className="landing-title-line2">
                  {t('landing.titleLine2')}
                  <svg
                    className="landing-title-underline"
                    viewBox="0 0 300 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 8 C 50 2, 100 2, 150 6 S 250 10, 298 4"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <Sparkles
                  size={20}
                  className="landing-title-sparkle"
                  style={{
                    animation: 'landingSparkle 3s ease-in-out infinite',
                  }}
                />
              </h1>

              {/* Subtitle */}
              <p
                className="landing-hero-subtitle"
                style={{ animation: 'landingFadeUp 0.7s ease-out 0.24s both' }}
              >
                {t('landing.subtitle')}
              </p>

              {/* Search bar */}
              <div
                className="landing-search-bar"
                style={{ animation: 'landingFadeUp 0.7s ease-out 0.32s both' }}
              >
                <div className="landing-search-field landing-search-field--location">
                  <MapPin
                    size={16}
                    className="landing-search-icon landing-search-icon--purple"
                  />
                  <div className="landing-search-field-content">
                    <span className="landing-search-label">
                      {t('landing.searchWhere')}
                    </span>
                    <span className="landing-search-placeholder">
                      {t('landing.searchWherePlaceholder')}
                    </span>
                  </div>
                </div>
                <div className="landing-search-divider" />
                <div className="landing-search-field">
                  <Calendar size={16} className="landing-search-icon" />
                  <div className="landing-search-field-content">
                    <span className="landing-search-label">
                      {t('landing.searchCheckIn')}
                    </span>
                    <span className="landing-search-placeholder">
                      {t('landing.searchDatesPlaceholder')}
                    </span>
                  </div>
                </div>
                <div className="landing-search-divider" />
                <div className="landing-search-field">
                  <Calendar size={16} className="landing-search-icon" />
                  <div className="landing-search-field-content">
                    <span className="landing-search-label">
                      {t('landing.searchCheckOut')}
                    </span>
                    <span className="landing-search-placeholder">
                      {t('landing.searchDatesPlaceholder')}
                    </span>
                  </div>
                </div>
                <div className="landing-search-divider" />
                <div className="landing-search-field">
                  <Users size={16} className="landing-search-icon" />
                  <div className="landing-search-field-content">
                    <span className="landing-search-label">
                      {t('landing.searchGuests')}
                    </span>
                    <span className="landing-search-placeholder">
                      {t('landing.searchGuestsPlaceholder')}
                    </span>
                  </div>
                </div>
                <Link
                  to="/select-location"
                  search={DEFAULT_SELECT_LOCATION_SEARCH}
                  className="landing-search-btn"
                  aria-label="Search hotels"
                >
                  <Search size={20} />
                </Link>
              </div>

              {/* CTA buttons */}
              <div
                className="flex flex-wrap items-center gap-3 pt-2"
                style={{ animation: 'landingFadeUp 0.7s ease-out 0.40s both' }}
              >
                <Button asChild size="lg" className="group h-11 px-6 rounded-xl text-sm font-semibold gap-2 bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/25 hover:shadow-violet-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300">
                  <Link
                    to="/select-location"
                    search={DEFAULT_SELECT_LOCATION_SEARCH}
                  >
                    {t('landing.browseHotels')}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 px-6 rounded-xl text-sm font-semibold border-slate-900 dark:border-slate-300 text-slate-900 dark:text-slate-100 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-900 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md transition-all duration-300">
                  <Link
                    to="/sign-up"
                    search={DEFAULT_AUTH_SEARCH}
                  >
                    {t('landing.createFreeAccount')}
                  </Link>
                </Button>
              </div>

              {/* Trust pills */}
              <div
                className="landing-trust-row"
                style={{ animation: 'landingFadeUp 0.7s ease-out 0.48s both' }}
              >
                {[
                  { icon: ShieldCheck, text: t('landing.pill1') },
                  { icon: Calendar, text: t('landing.pill2') },
                  { icon: Heart, text: t('landing.pill3') },
                ].map((pill) => (
                  <div key={pill.text} className="landing-trust-pill">
                    <pill.icon size={13} className="landing-trust-pill-icon" />
                    <span>{pill.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side — Cascading image gallery */}
            <div
              className="landing-gallery"
              style={{ animation: 'landingFadeUp 0.9s ease-out 0.2s both' }}
            >
              <div className="landing-gallery-inner">
                {/* Background glow */}
                <div className="landing-gallery-glow" />

                {/* Card 1 — Main / largest — Infinity pool */}
                <div
                  className="landing-gallery-card landing-gallery-card--main"
                  style={{
                    animation:
                      'landingGalleryFloat1 8s ease-in-out infinite, landingFadeUp 0.8s ease-out 0.3s both',
                  }}
                >
                  <img
                    src="/assets/infinity-pool.webp"
                    alt="Luxury infinity pool overlooking mountains at sunset"
                    className="landing-gallery-img"
                  />
                  <div className="landing-gallery-card-gradient" />
                  <div className="landing-gallery-card-label">
                    <p className="landing-gallery-card-title">
                      {t('landing.galleryPoolTitle')}
                    </p>
                    <p className="landing-gallery-card-desc">
                      {t('landing.galleryPoolDesc')}
                    </p>
                  </div>
                  <div className="landing-card-rating">
                    <Star size={11} className="landing-card-rating-star" />
                    <span>{t('landing.galleryRatingSort')}</span>
                  </div>
                  <div className="landing-gallery-card-shine" />
                </div>

                {/* Card 2 — Upper right — Hotel lobby */}
                <div
                  className="landing-gallery-card landing-gallery-card--top"
                  style={{
                    animation:
                      'landingGalleryFloat2 9s ease-in-out infinite, landingFadeUp 0.8s ease-out 0.45s both',
                  }}
                >
                  <img
                    src="/assets/hotel-lobby.webp"
                    alt="Luxurious hotel lobby with elegant chandeliers"
                    className="landing-gallery-img"
                  />
                  <div className="landing-gallery-card-gradient" />
                  <div className="landing-gallery-card-label">
                    <p className="landing-gallery-card-title">
                      {t('landing.galleryLobbyTitle')}
                    </p>
                    <p className="landing-gallery-card-desc">
                      {t('landing.galleryLobbyDesc')}
                    </p>
                  </div>
                  <div className="landing-gallery-card-shine" />
                </div>

                {/* Card 3 — Lower right — Boutique room */}
                <div
                  className="landing-gallery-card landing-gallery-card--bottom"
                  style={{
                    animation:
                      'landingGalleryFloat3 10s ease-in-out infinite, landingFadeUp 0.8s ease-out 0.55s both',
                  }}
                >
                  <img
                    src="/assets/boutique-room.webp"
                    alt="Cozy boutique hotel room with mountain views"
                    className="landing-gallery-img"
                  />
                  <div className="landing-gallery-card-gradient" />
                  <div className="landing-gallery-card-label">
                    <p className="landing-gallery-card-title">
                      {t('landing.galleryRoomTitle')}
                    </p>
                    <p className="landing-gallery-card-desc">
                      {t('landing.galleryRoomDesc')}
                    </p>
                  </div>
                  <div className="landing-gallery-card-shine" />
                </div>

                {/* Floating badge — Rating sort */}
                <div
                  className="landing-float-badge landing-float-badge--rating"
                  style={{
                    animation:
                      'landingGalleryFloat2 7s ease-in-out infinite, landingFadeUp 0.6s ease-out 0.7s both',
                  }}
                >
                  <div className="landing-float-badge-icon landing-float-badge-icon--gold">
                    <Star size={14} />
                  </div>
                  <div>
                    <p className="landing-float-badge-value">
                      {t('landing.galleryRatingTitle')}
                    </p>
                    <p className="landing-float-badge-label">
                      {t('landing.galleryRatingDesc')}
                    </p>
                  </div>
                </div>

                {/* Floating badge — Existing listings */}
                <div
                  className="landing-float-badge landing-float-badge--verified"
                  style={{
                    animation:
                      'landingGalleryFloat3 8s ease-in-out infinite, landingFadeUp 0.6s ease-out 0.8s both',
                  }}
                >
                  <div className="landing-float-badge-icon landing-float-badge-icon--green">
                    <CheckCircle2 size={14} />
                  </div>
                  <div>
                    <p className="landing-float-badge-value">
                      {t('landing.galleryListingsTitle')}
                    </p>
                    <p className="landing-float-badge-label">
                      {t('landing.galleryListingsDesc')}
                    </p>
                  </div>
                </div>

                {/* Decorative dots */}
                <div className="landing-dot-grid" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="landing-feature-strip">
        <div className="landing-feature-strip-inner">
          {[
            {
              icon: Heart,
              title: t('landing.featureHandpickedTitle'),
              desc: t('landing.featureHandpickedDesc'),
            },
            {
              icon: ShieldCheck,
              title: t('landing.featureSecureTitle'),
              desc: t('landing.featureSecureDesc'),
            },
            {
              icon: Calendar,
              title: t('landing.featureFlexibleTitle'),
              desc: t('landing.featureFlexibleDesc'),
            },
            {
              icon: Tag,
              title: t('landing.featureDealsTitle'),
              desc: t('landing.featureDealsDesc'),
            },
          ].map((feature, index) => (
            <div
              key={feature.title}
              className="landing-feature-item"
              style={{
                animation: `landingFadeUp 0.5s ease-out ${0.1 + index * 0.08}s both`,
              }}
            >
              <div className="landing-feature-icon-wrap">
                <feature.icon size={20} />
              </div>
              <div>
                <p className="landing-feature-title">{feature.title}</p>
                <p className="landing-feature-desc">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Marketplace discovery */}
      <section className="landing-marketplace-section">
        <div className="landing-section-container">
          {/* Section heading — proper vertical hierarchy */}
          <div className="mb-10 md:mb-14 max-w-3xl">
            <div className="landing-section-kicker mb-4">
              <LayoutGrid size={14} />
              <span>{t('landing.marketplaceKicker')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-5xl font-extrabold tracking-tight leading-[1.1] text-slate-900 dark:text-slate-100">
              {t('landing.marketplaceTitle')}
            </h2>
            <p className="mt-4 text-base sm:text-lg lg:text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              {t('landing.marketplaceDesc')}
            </p>
          </div>

          <div className="landing-marketplace-grid">
            <div className="landing-browser-panel">
              <div className="landing-browser-toolbar">
                <div>
                  <p className="landing-browser-eyebrow">
                    {t('landing.browserEyebrow')}
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
                    {t('landing.browserTitle')}
                  </p>
                </div>
                <Button asChild variant="outline" size="lg" className="group h-10 px-4 rounded-xl text-sm font-semibold gap-2 border-violet-200/80 bg-violet-50/80 text-violet-700 hover:bg-violet-100 hover:border-violet-300 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-sm transition-all duration-300">
                  <Link
                    to="/select-location"
                    search={DEFAULT_SELECT_LOCATION_SEARCH}
                  >
                    <Search size={16} className="group-hover:scale-110 transition-transform duration-300" />
                    {t('landing.browserAction')}
                  </Link>
                </Button>
              </div>

              <div className="landing-browser-search">
                <Search size={17} />
                <span className="text-sm sm:text-base">{t('select.searchPlaceholder')}</span>
              </div>

              <div className="landing-browser-controls">
                {[
                  {
                    icon: MapPin,
                    label: t('select.allCities'),
                  },
                  {
                    icon: Filter,
                    label: t('select.allCategories'),
                  },
                  {
                    icon: Star,
                    label: t('select.sortByRating'),
                  },
                ].map((item) => (
                  <Link
                    key={item.label}
                    to="/select-location"
                    search={
                      item.label === t('select.sortByRating')
                        ? ratingSearch
                        : DEFAULT_SELECT_LOCATION_SEARCH
                    }
                    className="landing-browser-chip"
                  >
                    <item.icon size={15} />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                ))}
              </div>

              <div className="landing-browser-preview">
                <img
                  src="/assets/trifways-lakeside-hotel.webp"
                  alt="Lakeside hotel preview"
                  className="landing-browser-preview-img"
                />
                <div className="landing-browser-preview-copy">
                  <p className="text-base sm:text-lg font-bold">{t('landing.browserPreviewTitle')}</p>
                  <span className="text-sm">{t('landing.browserPreviewDesc')}</span>
                </div>
              </div>
            </div>

            <div className="landing-marketplace-copy">
              {[
                {
                  icon: Navigation,
                  title: t('landing.marketplacePoint1Title'),
                  desc: t('landing.marketplacePoint1Desc'),
                },
                {
                  icon: Star,
                  title: t('landing.marketplacePoint2Title'),
                  desc: t('landing.marketplacePoint2Desc'),
                },
                {
                  icon: BedDouble,
                  title: t('landing.marketplacePoint3Title'),
                  desc: t('landing.marketplacePoint3Desc'),
                },
              ].map((item) => (
                <article key={item.title} className="landing-marketplace-point">
                  <div className="landing-marketplace-point-icon">
                    <item.icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stay previews */}
      <section className="landing-stays-section">
        <div className="landing-section-container">
          {/* Section heading — proper vertical hierarchy */}
          <div className="mb-8 md:mb-12 max-w-3xl">
            <div className="landing-section-kicker mb-4">
              <BedDouble size={14} />
              <span>{t('landing.staysKicker')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-5xl font-extrabold tracking-tight leading-[1.1] text-slate-900 dark:text-slate-100">
              {t('landing.staysTitle')}
            </h2>
            <p className="mt-4 text-base sm:text-lg lg:text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              {t('landing.staysDesc')}
            </p>
          </div>

          <div className="landing-stay-grid">
            {[
              {
                image: '/assets/mountain-lodge.webp',
                title: t('landing.stayPoolTitle'),
                desc: t('landing.stayPoolDesc'),
              },
              {
                image: '/assets/rustic-suite.webp',
                title: t('landing.stayBoutiqueTitle'),
                desc: t('landing.stayBoutiqueDesc'),
              },
              {
                image: '/assets/adventure-lodge.webp',
                title: t('landing.stayServiceTitle'),
                desc: t('landing.stayServiceDesc'),
              },
            ].map((stay) => (
              <Link
                key={stay.title}
                to="/select-location"
                search={DEFAULT_SELECT_LOCATION_SEARCH}
                className="landing-stay-card"
              >
                <img
                  src={stay.image}
                  alt={stay.title}
                  className="landing-stay-card-img"
                />
                <div className="landing-stay-card-copy">
                  <p className="text-base sm:text-lg font-bold tracking-tight">{stay.title}</p>
                  <span className="text-sm">{stay.desc}</span>
                </div>
                <ArrowRight size={18} className="landing-stay-card-arrow" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Booking flow */}
      <section className="landing-flow-section">
        <div className="landing-section-container landing-flow-container">
          <div className="landing-flow-copy">
            <div className="landing-section-kicker mb-3">
              <ShieldCheck size={14} />
              <span>{t('landing.flowKicker')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-[1.12] text-slate-900 dark:text-slate-100">
              {t('landing.flowTitle')}
            </h2>
            <p className="mt-3 text-base sm:text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('landing.flowDesc')}
            </p>
            <Button asChild variant="outline" size="lg" className="group mt-3 h-10 px-5 rounded-xl text-sm font-semibold gap-2 border-violet-200/80 bg-violet-50/80 text-violet-700 hover:bg-violet-100 hover:border-violet-300 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-sm w-fit transition-all duration-300">
              <Link
                to="/select-location"
                search={DEFAULT_SELECT_LOCATION_SEARCH}
              >
                {t('landing.flowCta')}
                <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </Button>
          </div>

          <div className="landing-flow-steps">
            {[
              {
                icon: Search,
                title: t('landing.flowStep1Title'),
                desc: t('landing.flowStep1Desc'),
              },
              {
                icon: Calendar,
                title: t('landing.flowStep2Title'),
                desc: t('landing.flowStep2Desc'),
              },
              {
                icon: Building2,
                title: t('landing.flowStep3Title'),
                desc: t('landing.flowStep3Desc'),
              },
            ].map((step, index) => (
              <article key={step.title} className="landing-flow-step">
                <div className="landing-flow-step-number">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="landing-flow-step-icon">
                  <step.icon size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="landing-final-cta">
        <div className="landing-final-cta-inner">
          <div>
            <p className="landing-final-cta-kicker">
              {t('landing.finalKicker')}
            </p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{t('landing.finalTitle')}</h2>
          </div>
          <div className="landing-final-actions">
            <Button asChild size="lg" className="group h-10 px-5 rounded-xl text-sm font-semibold gap-2 bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/25 hover:shadow-violet-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300">
              <Link
                to="/select-location"
                search={DEFAULT_SELECT_LOCATION_SEARCH}
              >
                {t('landing.browseHotels')}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-10 px-5 rounded-xl text-sm font-semibold border-slate-900 dark:border-slate-300 text-slate-900 dark:text-slate-100 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-900 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md transition-all duration-300">
              <Link
                to="/sign-in"
                search={DEFAULT_AUTH_SEARCH}
              >
                {t('landing.alreadyHaveAccount')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-logo">
            <img
              src="/logo.webp"
              alt="TripWays Hotels"
              className="landing-footer-logo-img"
            />
          </div>
          <p className="landing-footer-copyright">
            &copy; {new Date().getFullYear()} TripWays Hotels.{' '}
            {t('common.allRightsReserved')}
          </p>
        </div>
      </footer>

      {/* CSS animations */}
      <style>{`
        @keyframes landingFadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes landingSparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.1) rotate(15deg); }
        }

        @keyframes landingGalleryFloat1 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        @keyframes landingGalleryFloat2 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes landingGalleryFloat3 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}
