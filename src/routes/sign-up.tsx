import { Link, createFileRoute, useLocation } from '@tanstack/react-router'
import { SignUp } from '@clerk/clerk-react'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'
import { getClerkAuthAppearance } from '../lib/clerkAppearance'
import { useTheme } from '../lib/theme'

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  const { theme } = useTheme()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const redirectParam = params.get('redirect')
  const redirectTarget =
    redirectParam &&
    redirectParam.startsWith('/') &&
    !redirectParam.startsWith('//')
      ? redirectParam
      : null
  const encodedRedirect = redirectTarget
    ? encodeURIComponent(redirectTarget)
    : null
  const postLoginUrl = encodedRedirect
    ? `/post-login?redirect=${encodedRedirect}`
    : '/post-login'
  const signInUrl = encodedRedirect
    ? `/sign-in?redirect=${encodedRedirect}`
    : '/sign-in'

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950" />

        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/30 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center group">
            <div className="h-12 rounded-xl bg-slate-950/70 border border-amber-500/30 px-3 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all duration-300">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-8 w-auto object-contain"
              />
            </div>
          </Link>

          {/* Main Content */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Start your journey with us
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Create an account to unlock exclusive deals, manage your bookings,
              and experience luxury stays around the world.
            </p>

            {/* Features */}
            <div className="mt-8 space-y-4">
              {[
                'Browse hotels by location',
                'Book and manage your stays',
                'Simple and secure booking',
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                  </div>
                  <span className="text-slate-300 font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-slate-600 text-sm">
            &copy; {new Date().getFullYear()} Luxe Hotels. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Sign Up Form */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft size={20} className="text-slate-400" />
            <span className="text-slate-400 font-medium">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <div className="h-8 rounded-lg bg-slate-950/70 border border-amber-500/30 px-1.5 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-5 w-auto object-contain"
              />
            </div>
          </div>
        </div>

        <div className="hidden lg:flex justify-end px-6 pt-6 lg:px-12">
          <ThemeToggle compact />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">
                Create your account
              </h1>
              <p className="text-slate-400">
                Join us for exclusive hotel deals
              </p>
            </div>

            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl={signInUrl}
              forceRedirectUrl={postLoginUrl}
              appearance={getClerkAuthAppearance(theme)}
            />

            <p className="text-center text-slate-500 text-sm mt-6">
              Already have an account?{' '}
              <Link
                to="/sign-in"
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
