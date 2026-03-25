// Header section for the customer bookings page with quick navigation actions.
import { Link } from '@tanstack/react-router'
import { UserButton } from '@clerk/clerk-react'
import { useState } from 'react'
import { ArrowLeft, Menu, X, Home, MapPin } from 'lucide-react'
import { LanguageSwitcher } from '../../../../components/LanguageSwitcher'
import { ThemeToggle } from '../../../../components/ThemeToggle'
import { NotificationBell } from '../../../../components/NotificationBell'
import { useI18n } from '../../../../lib/i18n'
import { DEFAULT_SELECT_LOCATION_SEARCH } from '../../../../lib/navigationSearch'

interface BookingsHeaderProps {
  userName: string
}

export function BookingsHeader({ userName }: BookingsHeaderProps) {
  // Sticky header keeps navigation/account actions visible while scrolling.
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Back arrow (all sizes) */}
            <Link
              to="/select-location"
              search={DEFAULT_SELECT_LOCATION_SEARCH}
              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-white">
              {t('bookings.title')}
            </h1>
          </div>

          {/* Desktop right-side actions */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher compact />
            <ThemeToggle compact />
            <NotificationBell />
            <span className="text-sm text-slate-400">{userName}</span>
            <UserButton afterSignOutUrl="/" />
          </div>

          {/* Mobile right-side: LanguageSwitcher + hamburger */}
          <div className="flex md:hidden items-center gap-3">
            <LanguageSwitcher compact />
            <button
              onClick={() => setIsOpen(true)}
              className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 group"
              aria-label={t('header.openMenu')}
            >
              <Menu
                size={22}
                className="text-slate-300 group-hover:text-blue-400 transition-colors"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-out Menu */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-800/50 shadow-2xl z-[60] transform transition-transform duration-500 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-10 rounded-xl bg-slate-950/70 border border-blue-500/30 px-1 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-8 w-auto object-contain logo-tight"
              />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {t('header.navigationMenu')}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2.5 hover:bg-white/5 rounded-xl transition-all duration-300 group"
            aria-label={t('header.closeMenu')}
          >
            <X
              size={22}
              className="text-slate-400 group-hover:text-white transition-colors"
            />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 group"
            >
              <Home
                size={20}
                className="group-hover:text-blue-400 transition-colors"
              />
              <span className="font-medium">{t('header.home')}</span>
            </Link>

            <Link
              to="/select-location"
              search={DEFAULT_SELECT_LOCATION_SEARCH}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 group"
            >
              <MapPin
                size={20}
                className="group-hover:text-blue-400 transition-colors"
              />
              <span className="font-medium">{t('header.browseLocations')}</span>
            </Link>
          </div>

          {/* Settings */}
          <div className="mt-6 pt-6 border-t border-slate-800/50">
            <div className="flex items-center gap-3 px-4 py-3">
              <ThemeToggle />
            </div>
          </div>
        </nav>

        {/* User Section at Bottom */}
        <div className="p-4 border-t border-slate-800/50 bg-slate-800/30">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <NotificationBell />
            <span className="text-sm text-slate-400">{userName}</span>
          </div>
        </div>
      </aside>

      {/* Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] transition-all duration-500 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />
    </>
  )
}
