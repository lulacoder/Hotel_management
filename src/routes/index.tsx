import { useAuth } from '@clerk/clerk-react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, Compass, MapPin, ShieldCheck, Sparkles } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth()

  // If already signed in, redirect to post-login
  if (isLoaded && isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="relative mx-auto mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-500/20 border-t-amber-500"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-amber-500/10"></div>
          </div>
          <p className="text-slate-400 mb-2">Redirecting to dashboard...</p>
          <Link
            to="/post-login"
            className="text-amber-400 hover:text-amber-300 text-sm transition-colors"
          >
            Click here if not redirected
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="landing-page min-h-screen bg-slate-950 text-slate-100">
      <section className="landing-hero relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="landing-hero-bg absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.22),transparent_40%),radial-gradient(circle_at_75%_30%,rgba(249,115,22,0.18),transparent_42%),linear-gradient(180deg,#020617_0%,#020617_100%)]" />
          <div
            className="landing-hero-grid absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(251,191,36,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.18) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-20 lg:pb-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="landing-badge inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 mb-7">
                <Sparkles size={16} />
                Premium Hotel Booking Platform
              </div>

              <h1 className="landing-title text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tight mb-6">
                Stay in places
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500">
                  worth remembering
                </span>
              </h1>

              <p className="landing-subtitle max-w-2xl text-lg sm:text-xl text-slate-300/90 leading-relaxed mb-10">
                Browse trusted hotels, reserve in minutes, and manage every
                booking from one polished experience.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4">
                <Link
                  to="/select-location"
                  className="landing-primary-cta group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 font-semibold text-slate-950 shadow-lg shadow-amber-500/30 transition-all duration-300 hover:from-amber-400 hover:to-orange-400 hover:shadow-amber-500/45"
                >
                  <MapPin size={20} />
                  Browse Hotels
                  <ArrowRight
                    size={20}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
                <Link
                  to="/sign-up"
                  className="landing-secondary-cta inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-8 py-4 font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-900"
                >
                  Create Free Account
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  'Book by location in seconds',
                  'Live booking management',
                  'Clean and secure flow',
                ].map((value) => (
                  <div
                    key={value}
                    className="landing-pill flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/45 px-3 py-2.5 text-sm text-slate-300"
                  >
                    <CheckCircle2 size={16} className="text-amber-400" />
                    {value}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:pl-8">
              <div className="landing-info-card rounded-3xl border border-amber-500/25 bg-slate-900/65 p-7 shadow-[0_30px_100px_-45px_rgba(245,158,11,0.65)] backdrop-blur-xl">
                <img
                  src="/logo.png"
                  alt="Luxe Hotels"
                  className="h-14 w-auto object-contain"
                />

                <div className="mt-8 space-y-4">
                  <div className="landing-info-item rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-sm font-medium text-slate-300">
                      Pick a destination
                    </p>
                    <p className="mt-1 text-slate-500 text-sm">
                      Explore hotels by city and region from a single search
                      flow.
                    </p>
                  </div>
                  <div className="landing-info-item rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-sm font-medium text-slate-300">
                      Reserve with confidence
                    </p>
                    <p className="mt-1 text-slate-500 text-sm">
                      Track your stays and revisit bookings any time.
                    </p>
                  </div>
                  <Link
                    to="/sign-in"
                    className="landing-signin-link inline-flex items-center gap-2 text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Already have an account? Sign in
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features-section border-y border-slate-800/70 bg-slate-900/35 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">
            Why guests choose this platform
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="landing-feature-card rounded-2xl border border-slate-800 bg-slate-900/55 p-6">
              <Compass className="text-amber-400 mb-4" size={22} />
              <h3 className="text-lg font-semibold text-slate-100 mb-2">
                Better discovery
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Find the right stay quickly with location-first browsing and a
                focused booking path.
              </p>
            </article>
            <article className="landing-feature-card rounded-2xl border border-slate-800 bg-slate-900/55 p-6">
              <ShieldCheck className="text-amber-400 mb-4" size={22} />
              <h3 className="text-lg font-semibold text-slate-100 mb-2">
                Reliable booking flow
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Sign in, reserve, and review your trips with a consistent and
                secure experience.
              </p>
            </article>
            <article className="landing-feature-card rounded-2xl border border-slate-800 bg-slate-900/55 p-6">
              <MapPin className="text-amber-400 mb-4" size={22} />
              <h3 className="text-lg font-semibold text-slate-100 mb-2">
                Designed for real travel
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Clear navigation and quick access to your booking history keep
                planning simple.
              </p>
            </article>
          </div>
        </div>
      </section>

      <footer className="landing-footer py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <img
            src="/logo.png"
            alt="Luxe Hotels"
            className="h-10 w-auto object-contain opacity-95"
          />
          <p className="landing-copyright text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Luxe Hotels. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
