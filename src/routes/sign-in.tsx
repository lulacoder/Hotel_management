import { createFileRoute, useLocation, Link } from '@tanstack/react-router'
import { SignIn } from '@clerk/clerk-react'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

function SignInPage() {
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
  const signUpUrl = encodedRedirect
    ? `/sign-up?redirect=${encodedRedirect}`
    : '/sign-up'

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950" />

        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-amber-500/30 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-xl bg-slate-950/70 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all duration-300">
              <img
                src="/logo192.png"
                alt="Luxe Hotels"
                className="w-8 h-8 object-contain"
              />
            </div>
            <div>
              <span className="text-xl font-semibold text-white tracking-tight">
                Luxe Hotels
              </span>
              <p className="text-xs text-slate-500 font-medium">
                Premium Stays
              </p>
            </div>
          </Link>

          {/* Main Content */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Welcome back
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Sign in to access your bookings, view upcoming stays, and manage
              your account settings.
            </p>

            {/* Stats/Trust Indicators */}
            <div className="mt-10 grid grid-cols-2 gap-6">
              {[
                { value: '500+', label: 'Premium Hotels' },
                { value: '50K+', label: 'Happy Guests' },
                { value: '100+', label: 'Destinations' },
                { value: '4.9', label: 'Average Rating' },
              ].map((stat, index) => (
                <div key={index}>
                  <p className="text-2xl font-bold text-amber-400">
                    {stat.value}
                  </p>
                  <p className="text-slate-500 text-sm font-medium">
                    {stat.label}
                  </p>
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

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft size={20} className="text-slate-400" />
            <span className="text-slate-400 font-medium">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-950/70 border border-amber-500/30 flex items-center justify-center">
              <img
                src="/logo192.png"
                alt="Luxe Hotels"
                className="w-5 h-5 object-contain"
              />
            </div>
            <span className="text-white font-semibold">Luxe Hotels</span>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">
                Welcome back
              </h1>
              <p className="text-slate-400">Sign in to continue</p>
            </div>

            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl={signUpUrl}
              forceRedirectUrl={postLoginUrl}
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-slate-900/50 border border-slate-800 shadow-2xl shadow-black/50 rounded-2xl',
                  headerTitle: 'text-white',
                  headerSubtitle: 'text-slate-400',
                  socialButtonsBlockButton:
                    'bg-slate-800 border-slate-700 text-white hover:bg-slate-700',
                  socialButtonsBlockButtonText: 'text-slate-300 font-medium',
                  dividerLine: 'bg-slate-700',
                  dividerText: 'text-slate-500',
                  formFieldLabel: 'text-slate-300',
                  formFieldInput:
                    'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20',
                  formButtonPrimary:
                    'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold shadow-lg shadow-amber-500/25',
                  footerActionLink: 'text-amber-400 hover:text-amber-300',
                  identityPreviewText: 'text-slate-300',
                  identityPreviewEditButton: 'text-amber-400',
                  formFieldInputShowPasswordButton: 'text-slate-400',
                  footer: 'hidden',
                },
              }}
            />

            <p className="text-center text-slate-500 text-sm mt-6">
              Don't have an account?{' '}
              <Link
                to="/sign-up"
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
