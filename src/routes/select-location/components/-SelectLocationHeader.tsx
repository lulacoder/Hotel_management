// Top header bar for select-location page with auth and navigation actions.
import { Link } from '@tanstack/react-router'
import { UserButton } from '@clerk/clerk-react'
import { useState } from 'react'
import { Home, MapPin, Menu, X } from 'lucide-react'
import { LanguageSwitcher } from '../../../components/LanguageSwitcher'
import { ThemeToggle } from '../../../components/ThemeToggle'
import { NotificationBell } from '../../../components/NotificationBell'
import { useI18n } from '../../../lib/i18n'
import {
  DEFAULT_AUTH_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../../../lib/navigationSearch'

interface SelectLocationHeaderProps {
  isSignedIn: boolean
  userName: string
}

export function SelectLocationHeader({
  isSignedIn,
  userName,
}: SelectLocationHeaderProps) {
  // Header adapts account actions depending on signed-in state.
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="brand-logo-shell h-10 px-1">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-8 w-auto object-contain logo-tight"
              />
            </div>
            <h1 className="text-xl font-semibold text-slate-100 hidden md:block">
              {t('select.hotelBooking')}
            </h1>
          </div>

          {/* Desktop right-side actions */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher compact />
            <ThemeToggle compact />
            {isSignedIn ? (
              <>
                <Link
                  to="/bookings"
                  className="header-primary-btn rounded-lg px-3 py-1.5 text-sm font-semibold"
                >
                  {t('header.myBookings')}
                </Link>
                <NotificationBell />
                <span className="text-sm text-slate-500">{userName}</span>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <Link
                  to="/sign-in"
                  search={DEFAULT_AUTH_SEARCH}
                  className="header-inline-link font-medium"
                >
                  {t('header.signIn')}
                </Link>
                <Link
                  to="/sign-up"
                  search={DEFAULT_AUTH_SEARCH}
                  className="header-primary-btn rounded-lg px-3 py-1.5 font-semibold"
                >
                  {t('header.signUp')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile right-side: LanguageSwitcher + My Bookings + hamburger */}
          <div className="flex md:hidden items-center gap-3">
            <LanguageSwitcher compact />
            {isSignedIn && (
              <Link
                to="/bookings"
                className="header-primary-btn rounded-lg px-3 py-1.5 text-sm font-semibold"
              >
                {t('header.myBookings')}
              </Link>
            )}
            <button
              onClick={() => setIsOpen(true)}
              className="cursor-pointer p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 group"
              aria-label={t('header.openMenu')}
            >
              <Menu
                size={22}
                className="text-slate-300 group-hover:text-violet-400 transition-colors"
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
        {/* Menu Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="brand-logo-shell h-10 px-1">
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
            className="cursor-pointer p-2.5 hover:bg-white/5 rounded-xl transition-all duration-300 group"
            aria-label={t('header.closeMenu')}
          >
            <X
              size={22}
              className="text-slate-400 group-hover:text-white transition-colors"
            />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 group"
            >
              <Home
                size={20}
                className="group-hover:text-violet-400 transition-colors"
              />
              <span className="font-medium">{t('header.home')}</span>
            </Link>

            <Link
              to="/select-location"
              search={DEFAULT_SELECT_LOCATION_SEARCH}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 transition-all duration-300"
            >
              <MapPin size={20} />
              <span className="font-medium">{t('header.browseLocations')}</span>
            </Link>
          </div>

          {/* Settings */}
          <div className="mt-6 pt-6 border-t border-slate-800/50">
            <div className="flex items-center gap-3 px-4 py-3">
              <ThemeToggle />
            </div>
          </div>

          {!isSignedIn && (
            <div className="mt-6 pt-6 border-t border-slate-800/50">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3 px-4">
                {t('header.account')}
              </p>
              <div className="space-y-2">
                <Link
                  to="/sign-in"
                  search={DEFAULT_AUTH_SEARCH}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-300 border border-slate-700 hover:border-slate-600 hover:bg-white/5 transition-all duration-300 font-medium"
                >
                  {t('header.signIn')}
                </Link>
                <Link
                  to="/sign-up"
                  search={DEFAULT_AUTH_SEARCH}
                  onClick={() => setIsOpen(false)}
                  className="header-primary-btn flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold"
                >
                  {t('header.createAccount')}
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* User Section at Bottom */}
        {isSignedIn && (
          <div className="p-4 border-t border-slate-800/50 bg-slate-800/30">
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <NotificationBell dropDirection="up" />
              <span className="text-sm text-slate-400">{userName}</span>
            </div>
          </div>
        )}
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
