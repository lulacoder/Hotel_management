import { Link, useLocation } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { CalendarCheck, Home, MapPin, Menu } from 'lucide-react'

import ClerkHeader from '../integrations/clerk/header-user'
import { useI18n } from '../lib/i18n/provider'
import {
  DEFAULT_AUTH_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../lib/navigationSearch'
import { cn } from '../lib/utils'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { Button } from './ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { isSignedIn } = useAuth()
  const { t } = useI18n()
  const location = useLocation()

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
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (isAuthPage || isPostLoginPage || isAdminRoute || isCustomerAppRoute) {
    return null
  }

  const navLinks = [
    {
      icon: Home,
      label: t('header.home'),
      to: '/' as const,
    },
    {
      icon: MapPin,
      label: t('header.browseLocations'),
      to: '/select-location' as const,
      search: DEFAULT_SELECT_LOCATION_SEARCH,
    },
    ...(isSignedIn
      ? [
          {
            icon: CalendarCheck,
            label: t('header.myBookings'),
            to: '/bookings' as const,
          },
        ]
      : []),
  ]

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-30 transition-all duration-500',
          scrolled
            ? 'border-b border-slate-800/50 bg-slate-900/95 shadow-lg shadow-black/20 backdrop-blur-xl'
            : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl text-slate-300 hover:bg-white/8 hover:text-violet-300"
                  aria-label={t('header.openMenu')}
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-80 border-r border-slate-800/60 bg-slate-900/95 p-0 text-slate-100 backdrop-blur-xl"
              >
                <SheetHeader className="border-b border-slate-800/50 px-5 py-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="brand-logo-shell h-9 px-1">
                      <img
                        src="/logo.webp"
                        alt="TripWays Hotels"
                        className="logo-tight h-full w-auto object-contain"
                      />
                    </div>
                    <div>
                      <SheetTitle className="text-slate-100">
                        TripWays Hotels
                      </SheetTitle>
                      <SheetDescription className="text-xs text-slate-500">
                        {t('header.navigationMenu')}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <nav className="flex-1 space-y-2 p-4">
                  {navLinks.map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      search={item.search}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 font-medium transition-all',
                        'text-slate-400 hover:border-slate-700/70 hover:bg-slate-800/60 hover:text-slate-100',
                      )}
                      activeProps={{
                        className:
                          'flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 font-medium text-violet-300',
                      }}
                    >
                      <item.icon className="size-5" />
                      <span>{item.label}</span>
                    </Link>
                  ))}

                  <div className="mt-6 border-t border-slate-800/50 pt-6">
                    <ThemeToggle className="w-full justify-center" />
                  </div>

                  {!isSignedIn && (
                    <div className="mt-6 space-y-2 border-t border-slate-800/50 pt-6">
                      <Button
                        asChild
                        variant="outline"
                        className="w-full justify-center border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-700"
                      >
                        <Link
                          to="/sign-in"
                          search={DEFAULT_AUTH_SEARCH}
                          onClick={() => setMenuOpen(false)}
                        >
                          {t('header.signIn')}
                        </Link>
                      </Button>
                      <Button
                        asChild
                        className="header-primary-btn w-full justify-center rounded-xl"
                      >
                        <Link
                          to="/sign-up"
                          search={DEFAULT_AUTH_SEARCH}
                          onClick={() => setMenuOpen(false)}
                        >
                          {t('header.createAccount')}
                        </Link>
                      </Button>
                    </div>
                  )}
                </nav>

                {isSignedIn && (
                  <div className="border-t border-slate-800/50 bg-slate-800/30 p-4">
                    <ClerkHeader />
                  </div>
                )}
              </SheetContent>
            </Sheet>

            <Link to="/" className="group flex items-center">
              <div className="brand-logo-shell h-9 px-1 transition-all duration-300 group-hover:opacity-90">
                <img
                  src="/logo.webp"
                  alt="TripWays Hotels"
                  className="logo-tight h-full w-auto object-contain"
                />
              </div>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {isSignedIn && (
              <Button
                asChild
                className="header-primary-btn rounded-xl px-4 py-2 text-sm font-semibold"
              >
                <Link to="/bookings">
                  <CalendarCheck className="mr-2 size-4" />
                  {t('header.myBookings')}
                </Link>
              </Button>
            )}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher compact />
            <div className="hidden md:block">
              <ThemeToggle compact />
            </div>
            {!isSignedIn ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="header-inline-link hidden px-4 py-2 text-sm font-medium sm:inline-flex"
                >
                  <Link to="/sign-in" search={DEFAULT_AUTH_SEARCH}>
                    {t('header.signIn')}
                  </Link>
                </Button>
                <Button
                  asChild
                  className="header-primary-btn rounded-xl px-5 py-2.5 text-sm font-semibold"
                >
                  <Link to="/sign-up" search={DEFAULT_AUTH_SEARCH}>
                    {t('header.getStarted')}
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <ClerkHeader />
                <NotificationBell />
              </>
            )}
          </div>
        </div>
      </header>

      <div className="h-16 sm:h-20" />
    </>
  )
}
