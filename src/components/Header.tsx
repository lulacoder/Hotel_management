import { Link, useLocation } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'

import { useEffect, useState } from 'react'
import { CalendarCheck, Home, MapPin, Menu, X } from 'lucide-react'
import ClerkHeader from '../integrations/clerk/header-user'
import { useI18n } from '../lib/i18n'
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
            <div className="flex items-center gap-2 sm:gap-4">
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
              <Link to="/" className="flex items-center gap-3 group">
                <div className="h-10 rounded-xl bg-slate-950/70 border border-blue-500/30 px-1 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-300 group-hover:scale-105">
                  <img
                    src="/logo.png"
                    alt="Luxe Hotels"
                    className="h-8 w-auto object-contain logo-tight"
                  />
                </div>
              </Link>
            </div>

            {/* Center: Quick Links (Desktop) */}
            <nav className="hidden md:flex items-center gap-1">
              {isSignedIn && (
                <Link
                  to="/bookings"
                  className="px-4 py-2 text-sm font-semibold text-slate-900 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors flex items-center gap-2"
                >
                  <CalendarCheck size={16} />
                  {t('header.myBookings')}
                </Link>
              )}
            </nav>

            {/* Right: Auth */}
            <div className="flex items-center gap-3">
              <LanguageSwitcher compact />
              <div className="hidden md:block">
                <ThemeToggle compact />
              </div>
              {!isSignedIn && (
                <>
                  <Link
                    to="/sign-in"
                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block"
                  >
                    {t('header.signIn')}
                  </Link>
                  <Link
                    to="/sign-up"
                    className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105"
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
        className={`fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-800/50 shadow-2xl z-50 transform transition-transform duration-500 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Menu Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-10 rounded-xl bg-slate-950/70 border border-blue-500/30 px-1 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-8 w-auto object-contain logo-tight"
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">
                {t('header.navigationMenu')}
              </p>
            </div>
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

        {/* Navigation Links */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 group"
              activeProps={{
                className:
                  'flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 transition-all duration-300',
              }}
            >
              <Home
                size={20}
                className="group-hover:text-blue-400 transition-colors"
              />
              <span className="font-medium">{t('header.home')}</span>
            </Link>

            <Link
              to="/select-location"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 group"
              activeProps={{
                className:
                  'flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 transition-all duration-300',
              }}
            >
              <MapPin
                size={20}
                className="group-hover:text-blue-400 transition-colors"
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
                    'flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 transition-all duration-300',
                }}
              >
                <CalendarCheck
                  size={20}
                  className="group-hover:text-blue-400 transition-colors"
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
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-300 border border-slate-700 hover:border-slate-600 hover:bg-white/5 transition-all duration-300 font-medium"
                >
                  {t('header.signIn')}
                </Link>
                <Link
                  to="/sign-up"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25"
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
