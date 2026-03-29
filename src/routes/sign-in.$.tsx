// Catch-all sign-in route variant to support Clerk callback/path patterns.
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { SignIn } from '@clerk/clerk-react'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'
import { buildRedirectSearch, sanitizeRedirect } from '../lib/authRouting'
import { useI18n } from '../lib/i18n'
import { getClerkAuthAppearance } from '../lib/clerkAppearance'
import { useTheme } from '../lib/theme'

export const Route = createFileRoute('/sign-in/$')({
  beforeLoad: ({ context, search }) => {
    const auth = context.auth.getClientSnapshot()

    if (auth.isLoaded && auth.isSignedIn) {
      throw redirect({
        to: '/post-login',
        search: buildRedirectSearch(search.redirect),
      })
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  // Handles Clerk path/callback variants while reusing sign-in UX.
  component: SignInCatchAll,
})

function SignInCatchAll() {
  // Keep redirect intent when this fallback route is used.
  const search = Route.useSearch()
  const { theme } = useTheme()
  const { t } = useI18n()
  const encodedRedirect = search.redirect
    ? encodeURIComponent(search.redirect)
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
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-slate-900 to-slate-950" />

        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-violet-500/30 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center group">
            <div className="brand-logo-shell h-12 px-1 flex items-center justify-center group-hover:shadow-violet-500/40 transition-all duration-300">
              <img
                src="/logo.png"
                alt="Trip Way Hotels"
                className="h-9 w-auto object-contain logo-tight"
              />
            </div>
          </Link>

          {/* Main Content */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              {t('signIn.welcomeBack')}
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              {t('signIn.description')}
            </p>
          </div>

          {/* Footer */}
          <p className="text-slate-600 text-sm">
            &copy; {new Date().getFullYear()} Trip Way Hotels.{' '}
            {t('common.allRightsReserved')}
          </p>
        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft size={20} className="text-slate-400" />
            <span className="text-slate-400 font-medium">
              {t('signIn.back')}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <div className="brand-logo-shell h-8 px-1 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-6 w-auto object-contain logo-tight"
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
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl={signUpUrl}
              forceRedirectUrl={postLoginUrl}
              appearance={getClerkAuthAppearance(theme)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
