import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import { Link } from '@tanstack/react-router'
import { Building2, CalendarCheck, Users, Shield } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth()

  // If already signed in, redirect to post-login
  if (isLoaded && isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
          <Link
            to="/post-login"
            className="text-indigo-600 hover:text-indigo-800 mt-2 inline-block"
          >
            Click here if not redirected
          </Link>
        </div>
      </div>
    )
  }

  const features = [
    {
      icon: <Building2 className="w-10 h-10 text-indigo-600" />,
      title: 'Room Management',
      description:
        'Easily manage room availability, pricing, and amenities across multiple locations.',
    },
    {
      icon: <CalendarCheck className="w-10 h-10 text-indigo-600" />,
      title: 'Easy Bookings',
      description:
        'Streamlined booking process for customers with real-time availability updates.',
    },
    {
      icon: <Users className="w-10 h-10 text-indigo-600" />,
      title: 'Customer Portal',
      description:
        'Dedicated portal for customers to manage their reservations and preferences.',
    },
    {
      icon: <Shield className="w-10 h-10 text-indigo-600" />,
      title: 'Secure Access',
      description:
        'Role-based authentication ensures secure access for admins and customers.',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <section className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Building2 className="w-12 h-12 text-indigo-600" />
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              Hotel Management
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-gray-600 mb-4 max-w-2xl mx-auto">
            Modern hotel management system for seamless room bookings and
            administration
          </p>
          <p className="text-gray-500 mb-8 max-w-xl mx-auto">
            Whether you're a guest looking to book a room or an administrator
            managing properties, our platform provides everything you need.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/sign-in"
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-indigo-500/30 w-full sm:w-auto"
            >
              Sign In
            </Link>
            <Link
              to="/sign-up"
              className="px-8 py-3 bg-white hover:bg-gray-50 text-indigo-600 font-semibold rounded-lg transition-colors border-2 border-indigo-600 w-full sm:w-auto"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Choose Us?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-100"
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 bg-indigo-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-indigo-100 mb-8">
            Sign in to access your bookings or create a new account to get
            started.
          </p>
          <Link
            to="/sign-in"
            className="px-8 py-3 bg-white hover:bg-gray-100 text-indigo-600 font-semibold rounded-lg transition-colors inline-block"
          >
            Sign In Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-gray-900 text-center">
        <p className="text-gray-400 text-sm">
          © {new Date().getFullYear()} Hotel Management System. All rights
          reserved.
        </p>
      </footer>
    </div>
  )
}
