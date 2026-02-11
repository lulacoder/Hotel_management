import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import { Link } from '@tanstack/react-router'
import {
  Building2,
  CalendarCheck,
  Users,
  Shield,
  MapPin,
  Star,
  ArrowRight,
  Sparkles,
  Wifi,
  Coffee,
  Car,
} from 'lucide-react'

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

  const features = [
    {
      icon: <Building2 className="w-6 h-6" />,
      title: 'Premium Properties',
      description:
        'Handpicked luxury hotels and boutique stays in prime locations worldwide.',
    },
    {
      icon: <CalendarCheck className="w-6 h-6" />,
      title: 'Instant Booking',
      description:
        'Book in seconds with real-time availability and instant confirmation.',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'VIP Experience',
      description:
        'Dedicated concierge service and exclusive member benefits for every stay.',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Secure & Private',
      description:
        'Bank-level encryption and privacy protection for all your data.',
    },
  ]

  const destinations = [
    {
      name: 'Dubai',
      country: 'UAE',
      properties: 45,
      image:
        'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80',
    },
    {
      name: 'Paris',
      country: 'France',
      properties: 62,
      image:
        'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',
    },
    {
      name: 'Tokyo',
      country: 'Japan',
      properties: 38,
      image:
        'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80',
    },
    {
      name: 'New York',
      country: 'USA',
      properties: 84,
      image:
        'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80',
    },
  ]

  const amenities = [
    { icon: <Wifi size={20} />, label: 'Free WiFi' },
    { icon: <Coffee size={20} />, label: 'Breakfast' },
    { icon: <Car size={20} />, label: 'Parking' },
    { icon: <Sparkles size={20} />, label: 'Spa' },
  ]

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

            {/* Quick Stats */}
            <div className="flex flex-wrap items-center gap-8 mt-12 pt-8 border-t border-slate-800/50">
              {[
                { value: '500+', label: 'Hotels' },
                { value: '100+', label: 'Destinations' },
                { value: '50K+', label: 'Happy Guests' },
                { value: '4.9', label: 'Rating', icon: Star },
              ].map((stat, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">
                    {stat.value}
                  </span>
                  {stat.icon && (
                    <stat.icon
                      size={16}
                      className="text-amber-400 fill-amber-400"
                    />
                  )}
                  <span className="text-slate-500 font-medium">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Why Choose{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                Luxe Hotels
              </span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              We combine luxury with technology to deliver the best booking
              experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 bg-slate-900/50 border border-slate-800/50 rounded-2xl hover:bg-slate-900 hover:border-slate-700 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Destinations */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-12">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Popular Destinations
              </h2>
              <p className="text-slate-400">
                Explore our most-booked locations
              </p>
            </div>
            <Link
              to="/select-location"
              className="mt-4 sm:mt-0 flex items-center gap-2 text-amber-400 hover:text-amber-300 font-medium transition-colors"
            >
              View All
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {destinations.map((dest, index) => (
              <Link
                key={index}
                to="/select-location"
                className="group relative h-72 rounded-2xl overflow-hidden"
              >
                {/* Image */}
                <div className="absolute inset-0">
                  <img
                    src={dest.image}
                    alt={dest.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>

                {/* Content */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  <h3 className="text-xl font-bold text-white mb-1">
                    {dest.name}
                  </h3>
                  <p className="text-slate-300 text-sm mb-2">{dest.country}</p>
                  <div className="flex items-center gap-1 text-amber-400 text-sm font-medium">
                    <Building2 size={14} />
                    {dest.properties} properties
                  </div>
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Amenities Banner */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-y border-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {amenities.map((amenity, index) => (
              <div
                key={index}
                className="flex items-center gap-3 text-slate-400"
              >
                <div className="text-amber-400">{amenity.icon}</div>
                <span className="font-medium">{amenity.label}</span>
              </div>
            ))}
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
