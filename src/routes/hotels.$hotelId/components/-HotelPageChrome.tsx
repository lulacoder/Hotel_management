import { Link } from '@tanstack/react-router'
import { UserButton } from '@clerk/clerk-react'
import { Home, MapPin, Menu, X } from 'lucide-react'
import { useState } from 'react'

import { LanguageSwitcher } from '../../../components/LanguageSwitcher'
import { ThemeToggle } from '../../../components/ThemeToggle'
import { useI18n } from '../../../lib/i18n'
import {
  DEFAULT_AUTH_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../../../lib/navigationSearch'

interface HotelPageChromeProps {
  isSignedIn: boolean
  userFirstName?: string
}

export function HotelPageChrome({
  isSignedIn,
  userFirstName,
}: HotelPageChromeProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { t } = useI18n()

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link
            to="/select-location"
            search={DEFAULT_SELECT_LOCATION_SEARCH}
            className="flex items-center gap-2 text-slate-400 transition-colors hover:text-slate-200"
          >
            <MapPin className="h-5 w-5" />
            <span className="hidden md:inline">{t('hotel.backToHotels')}</span>
          </Link>

          <div className="hidden items-center gap-4 md:flex">
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

          <div className="flex items-center gap-3 md:hidden">
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
              onClick={() => setIsMobileMenuOpen(true)}
              className="group cursor-pointer rounded-xl p-2.5 transition-all duration-300 hover:bg-white/10"
              aria-label={t('header.openMenu')}
            >
              <Menu
                size={22}
                className="text-slate-300 transition-colors group-hover:text-violet-400"
              />
            </button>
          </div>
        </div>
      </header>

      <aside
        className={`fixed left-0 top-0 z-[60] flex h-full w-80 flex-col border-r border-slate-800/50 bg-slate-900 shadow-2xl transition-transform duration-500 ease-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800/50 p-5">
          <div className="flex items-center gap-3">
            <div className="brand-logo-shell flex h-10 items-center justify-center px-1">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="logo-tight h-8 w-auto object-contain"
              />
            </div>
            <p className="text-xs font-medium text-slate-500">
              {t('header.navigationMenu')}
            </p>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="group cursor-pointer rounded-xl p-2.5 transition-all duration-300 hover:bg-white/5"
            aria-label={t('header.closeMenu')}
          >
            <X
              size={22}
              className="text-slate-400 transition-colors group-hover:text-white"
            />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              activeProps={{
                className:
                  'flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-violet-400 transition-all duration-300',
              }}
              inactiveProps={{
                className:
                  'group flex items-center gap-3 rounded-xl px-4 py-3 text-slate-400 transition-all duration-300 hover:bg-white/5 hover:text-white',
              }}
            >
              <Home
                size={20}
                className="transition-colors group-hover:text-violet-400"
              />
              <span className="font-medium">{t('header.home')}</span>
            </Link>

            <Link
              to="/select-location"
              search={DEFAULT_SELECT_LOCATION_SEARCH}
              onClick={() => setIsMobileMenuOpen(false)}
              activeProps={{
                className:
                  'flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-violet-400 transition-all duration-300',
              }}
              inactiveProps={{
                className:
                  'group flex items-center gap-3 rounded-xl px-4 py-3 text-slate-400 transition-all duration-300 hover:bg-white/5 hover:text-white',
              }}
            >
              <MapPin
                size={20}
                className="transition-colors group-hover:text-violet-400"
              />
              <span className="font-medium">{t('header.browseLocations')}</span>
            </Link>
          </div>

          <div className="mt-6 border-t border-slate-800/50 pt-6">
            <div className="flex items-center gap-3 px-4 py-3">
              <ThemeToggle />
            </div>
          </div>

          {!isSignedIn && (
            <div className="mt-6 border-t border-slate-800/50 pt-6">
              <p className="mb-3 px-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                {t('header.account')}
              </p>
              <div className="space-y-2">
                <Link
                  to="/sign-in"
                  search={DEFAULT_AUTH_SEARCH}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="header-secondary-btn flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium"
                >
                  {t('header.signIn')}
                </Link>
                <Link
                  to="/sign-up"
                  search={DEFAULT_AUTH_SEARCH}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="header-primary-btn flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold"
                >
                  {t('header.createAccount')}
                </Link>
              </div>
            </div>
          )}
        </nav>

        {isSignedIn && (
          <div className="border-t border-slate-800/50 bg-slate-800/30 p-4">
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <span className="text-sm text-slate-400">{userFirstName ?? ''}</span>
            </div>
          </div>
        )}
      </aside>

      <div
        className={`fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm transition-all duration-500 ${
          isMobileMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />
    </>
  )
}
