import { Link } from '@tanstack/react-router'
import { UserButton } from '@clerk/clerk-react'
import { ThemeToggle } from '../../../components/ThemeToggle'

interface SelectLocationHeaderProps {
  isSignedIn: boolean
  userName: string
}

export function SelectLocationHeader({
  isSignedIn,
  userName,
}: SelectLocationHeaderProps) {
  return (
    <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-10 rounded-xl bg-slate-950/70 border border-amber-500/30 px-2 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <img
              src="/logo.png"
              alt="Luxe Hotels"
              className="h-7 w-auto object-contain"
            />
          </div>
          <h1 className="text-xl font-semibold text-slate-100">
            Hotel Booking
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle compact />
          {isSignedIn ? (
            <>
              <Link
                to="/bookings"
                className="px-3 py-1.5 text-sm font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
              >
                My Bookings
              </Link>
              <span className="text-sm text-slate-500">{userName}</span>
              <UserButton afterSignOutUrl="/" />
            </>
          ) : (
            <>
              <Link
                to="/sign-in"
                className="text-slate-400 hover:text-amber-400 transition-colors font-medium"
              >
                Sign In
              </Link>
              <Link
                to="/sign-up"
                className="px-3 py-1.5 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
