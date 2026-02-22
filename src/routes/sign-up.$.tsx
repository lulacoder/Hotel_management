import { Link, createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@clerk/clerk-react'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'
import { getClerkAuthAppearance } from '../lib/clerkAppearance'
import { useTheme } from '../lib/theme'

export const Route = createFileRoute('/sign-up/$')({
  component: SignUpCatchAll,
})

function SignUpCatchAll() {
  const { theme } = useTheme()

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/30 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/" className="inline-flex items-center group">
            <div className="h-12 rounded-xl bg-slate-950/70 border border-amber-500/30 px-3 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all duration-300">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-8 w-auto object-contain"
              />
            </div>
          </Link>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Start your journey with us
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Create an account to unlock exclusive deals, manage your bookings,
              and experience luxury stays around the world.
            </p>
          </div>

          <p className="text-slate-600 text-sm">
            &copy; {new Date().getFullYear()} Luxe Hotels. All rights reserved.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
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

        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              forceRedirectUrl="/post-login"
              appearance={getClerkAuthAppearance(theme)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
