import { useAuth } from '@clerk/clerk-react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, MapPin, Sparkles } from 'lucide-react'

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
    <div className="min-h-screen bg-slate-950">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          {/* Gradient Mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950" />

          {/* Animated Orbs */}
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-amber-500/20 rounded-full blur-[120px] animate-pulse" />
          <div
            className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-orange-500/15 rounded-full blur-[100px] animate-pulse"
            style={{ animationDelay: '1s' }}
          />

          {/* Grid Pattern Overlay */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8">
              <Sparkles size={16} className="text-amber-400" />
              <span className="text-amber-400 text-sm font-medium">
                Premium Hotel Booking Platform
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
              Experience{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                Luxury
              </span>{' '}
              Like Never Before
            </h1>

            <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-2xl">
              Discover handpicked hotels, exclusive member rates, and seamless
              booking experiences. Your perfect stay is just a click away.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Link
                to="/select-location"
                className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105"
              >
                <MapPin size={20} />
                Browse Hotels
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
              <Link
                to="/sign-up"
                className="flex items-center gap-3 px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all duration-300 border border-slate-700 hover:border-slate-600"
              >
                Create Free Account
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/20 rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Book Your Next{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Adventure
            </span>
            ?
          </h2>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Join thousands of travelers who trust Luxe Hotels for their premium
            accommodations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/sign-up"
              className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105"
            >
              Get Started Free
              <ArrowRight
                size={20}
                className="group-hover:translate-x-1 transition-transform"
              />
            </Link>
            <Link
              to="/sign-in"
              className="px-8 py-4 text-slate-300 hover:text-white font-medium transition-colors"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-950/70 border border-amber-500/30 flex items-center justify-center">
                <img
                  src="/logo192.png"
                  alt="Luxe Hotels"
                  className="w-7 h-7 object-contain"
                />
              </div>
              <div>
                <span className="text-lg font-semibold text-white">
                  Luxe Hotels
                </span>
                <p className="text-xs text-slate-500">Premium Stays</p>
              </div>
            </div>

            <p className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} Luxe Hotels. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
