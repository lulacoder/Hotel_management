import { Link } from '@tanstack/react-router'
import { UserButton } from '@clerk/clerk-react'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '../../../../components/ThemeToggle'

interface BookingsHeaderProps {
  userName: string
}

export function BookingsHeader({ userName }: BookingsHeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800/50 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link
            to="/select-location"
            className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">My Bookings</h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle compact />
          <span className="text-sm text-slate-400">{userName}</span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  )
}
