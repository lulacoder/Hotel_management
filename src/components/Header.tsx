import { Link, useLocation } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'

import { useEffect, useState } from 'react'
import { CalendarCheck, Home, MapPin, Menu, X } from 'lucide-react'
import ClerkHeader from '../integrations/clerk/header-user'
import { useI18n } from '../lib/i18n'
import {
  DEFAULT_AUTH_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../lib/navigationSearch'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { NotificationBell } from './NotificationBell'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { isSignedIn } = useAuth()
  const { t } = useI18n()
  const location = useLocation()

  // Hide header on auth pages, admin routes, and pages that provide their own header
  const isAuthPage =
    location.pathname.startsWith('/sign-in') ||
    location.pathname.startsWith('/sign-up')
  const isPostLoginPage = location.pathname.startsWith('/post-login')
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isCustomerAppRoute =
    location.pathname.startsWith('/select-location') ||
    location.pathname.startsWith('/hotels/') ||
    location.pathname.startsWith('/bookings') ||
    location.pathname.startsWith('/announcements')

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Don't render header on pages with their own navigation chrome
  if (isAuthPage || isPostLoginPage || isAdminRoute || isCustomerAppRoute) {
    return null
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-30 transition-all duration-500 ${
          scrolled
            ? 'bg-slate-900/95 backdrop-blur-xl shadow-lg shadow-black/20 border-b border-slate-800/50'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Left: Menu + Logo */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => setIsOpen(true)}
                className="group cursor-pointer rounded-xl p-2 transition-all duration-300 hover:bg-white/8"
                aria-label={t('header.openMenu')}
              >
                <Menu
                  size={20}
                  className="text-slate-400 group-hover:text-violet-400 transition-colors"
                />
              </button>
              <Link to="/" className="flex items-center group">
                <div className="brand-logo-shell h-9 px-1 transition-all duration-300 group-hover:opacity-90">
                  <img
                    src="/logo.png"
                    alt="TripWays Hotels"
                    className="logo-tight h-full w-auto object-contain"
                  />
                </div>
              </Link>
            </div>

            {/* Center: Quick Links (Desktop) */}
            <nav className="hidden md:flex items-center gap-1">
              {isSignedIn && (
                <Link
                  to="/bookings"
                  className="header-primary-btn flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  <CalendarCheck size={16} />
                  {t('header.myBookings')}
                </Link>
              )}
            </nav>

            {/* Right: Auth */}
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSwitcher compact />
              <div className="hidden md:block">
                <ThemeToggle compact />
              </div>
              {!isSignedIn && (
                <>
                  <Link
                    to="/sign-in"
                    search={DEFAULT_AUTH_SEARCH}
                    className="header-inline-link hidden px-4 py-2 text-sm font-medium sm:block"
                  >
                    {t('header.signIn')}
                  </Link>
                  <Link
                    to="/sign-up"
                    search={DEFAULT_AUTH_SEARCH}
                    className="header-primary-btn rounded-xl px-5 py-2.5 text-sm font-semibold"
                  >
                    {t('header.getStarted')}
                  </Link>
                </>
              )}
              {isSignedIn && <ClerkHeader />}
              {isSignedIn && <NotificationBell />}
            </div>
          </div>
        </div>
      </header>

      {/* Spacer to prevent content from going under fixed header */}
      <div className="h-16 sm:h-20" />

      {/* Slide-out Menu */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/50 shadow-2xl z-50 transform transition-transform duration-500 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Menu Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="brand-logo-shell h-9 px-1">
              <img
                src="/logo.png"
                alt="TripWays Hotels"
                className="logo-tight h-full w-auto object-contain"
              />
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="group cursor-pointer rounded-xl p-2 transition-all duration-300 hover:bg-white/5"
            aria-label={t('header.closeMenu')}
          >
            <X
              size={20}
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
              activeProps={{
                className:
                  'flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 transition-all duration-300',
              }}
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
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 group"
              activeProps={{
                className:
                  'flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 transition-all duration-300',
              }}
            >
              <MapPin
                size={20}
                className="group-hover:text-violet-400 transition-colors"
              />
              <span className="font-medium">{t('header.browseLocations')}</span>
            </Link>

            {isSignedIn && (
              <Link
                to="/bookings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 group"
                activeProps={{
                  className:
                    'flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 transition-all duration-300',
                }}
              >
                <CalendarCheck
                  size={20}
                  className="group-hover:text-violet-400 transition-colors"
                />
                <span className="font-medium">{t('header.myBookings')}</span>
              </Link>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800/50">
            <ThemeToggle className="w-full justify-center" />
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
                  className="header-primary-btn flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold"
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
            <ClerkHeader />
          </div>
        )}
      </aside>

      {/* Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-all duration-500 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />
    </>
  )
}
