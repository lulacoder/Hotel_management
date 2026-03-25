// Catch-all sign-up route variant for Clerk callback/path compatibility.
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { SignUp } from '@clerk/clerk-react'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'
import { buildRedirectSearch, sanitizeRedirect } from '../lib/authRouting'
import { useI18n } from '../lib/i18n'
import { getClerkAuthAppearance } from '../lib/clerkAppearance'
import { useTheme } from '../lib/theme'

export const Route = createFileRoute('/sign-up/$')({
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
  // Handles alternate Clerk sign-up paths using shared registration UI.
  component: SignUpCatchAll,
})

function SignUpCatchAll() {
  // Minimal wrapper around Clerk SignUp with app branding/theming.
  const search = Route.useSearch()
  const { theme } = useTheme()
  const { t } = useI18n()
  const encodedRedirect = search.redirect
    ? encodeURIComponent(search.redirect)
    : null
  const postLoginUrl = encodedRedirect
    ? `/post-login?redirect=${encodedRedirect}`
    : '/post-login'
  const signInUrl = encodedRedirect
    ? `/sign-in?redirect=${encodedRedirect}`
    : '/sign-in'

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-slate-900 to-slate-950" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/" className="inline-flex items-center group">
            <div className="h-12 rounded-xl bg-slate-950/70 border border-blue-500/30 px-1 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-300">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-9 w-auto object-contain logo-tight"
              />
            </div>
          </Link>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              {t('signUp.startJourney')}
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              {t('signUp.description')}
            </p>
          </div>

          <p className="text-slate-600 text-sm">
            &copy; {new Date().getFullYear()} Luxe Hotels.{' '}
            {t('common.allRightsReserved')}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="lg:hidden p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft size={20} className="text-slate-400" />
            <span className="text-slate-400 font-medium">
              {t('signIn.back')}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <div className="h-8 rounded-lg bg-slate-950/70 border border-blue-500/30 px-1 flex items-center justify-center">
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

        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl={signInUrl}
              forceRedirectUrl={postLoginUrl}
              appearance={getClerkAuthAppearance(theme)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

