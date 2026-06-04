import { Link } from '@tanstack/react-router'
import { UserButton } from '@clerk/clerk-react'
import { Home, MapPin, Menu } from 'lucide-react'
import { useState } from 'react'

import { LanguageSwitcher } from '../../../components/LanguageSwitcher'
import { NotificationBell } from '../../../components/NotificationBell'
import { ThemeToggle } from '../../../components/ThemeToggle'
import { Button } from '../../../components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../components/ui/sheet'
import { useI18n } from '../../../lib/i18n/provider'
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
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="brand-logo-shell h-10 px-1">
            <img
              src="/logo.webp"
              alt="Luxe Hotels"
              className="h-8 w-auto object-contain logo-tight"
            />
          </div>
          <h1 className="hidden text-xl font-semibold text-slate-100 md:block">
            {t('select.hotelBooking')}
          </h1>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <LanguageSwitcher compact />
          <ThemeToggle compact />
          {isSignedIn ? (
            <>
              <Button
                asChild
                className="header-primary-btn rounded-lg px-3 py-1.5 text-sm font-semibold"
              >
                <Link to="/bookings">{t('header.myBookings')}</Link>
              </Button>
              <NotificationBell />
              <span className="text-sm text-slate-500">{userName}</span>
              <UserButton afterSignOutUrl="/" />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="header-inline-link">
                <Link to="/sign-in" search={DEFAULT_AUTH_SEARCH}>
                  {t('header.signIn')}
                </Link>
              </Button>
              <Button
                asChild
                className="header-primary-btn rounded-lg px-3 py-1.5 font-semibold"
              >
                <Link to="/sign-up" search={DEFAULT_AUTH_SEARCH}>
                  {t('header.signUp')}
                </Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <LanguageSwitcher compact />
          {isSignedIn && (
            <Button
              asChild
              className="header-primary-btn rounded-lg px-3 py-1.5 text-sm font-semibold"
            >
              <Link to="/bookings">{t('header.myBookings')}</Link>
            </Button>
          )}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl text-slate-300 hover:bg-white/10 hover:text-violet-300"
                aria-label={t('header.openMenu')}
              >
                <Menu size={22} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-80 border-r border-slate-800/50 bg-slate-900/95 p-0 text-slate-100"
            >
              <SheetHeader className="border-b border-slate-800/50 px-5 py-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="brand-logo-shell h-10 px-1">
                    <img
                      src="/logo.webp"
                      alt="Luxe Hotels"
                      className="h-8 w-auto object-contain logo-tight"
                    />
                  </div>
                  <div>
                    <SheetTitle className="text-slate-100">
                      {t('select.hotelBooking')}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-slate-500">
                      {t('header.navigationMenu')}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <nav className="space-y-2 p-4">
                <Link
                  to="/"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-400 transition-all hover:bg-white/5 hover:text-white"
                >
                  <Home size={20} />
                  <span className="font-medium">{t('header.home')}</span>
                </Link>

                <Link
                  to="/select-location"
                  search={DEFAULT_SELECT_LOCATION_SEARCH}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-violet-400"
                >
                  <MapPin size={20} />
                  <span className="font-medium">
                    {t('header.browseLocations')}
                  </span>
                </Link>

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
                        onClick={() => setIsOpen(false)}
                      >
                        {t('header.signIn')}
                      </Link>
                    </Button>
                    <Button
                      asChild
                      className="header-primary-btn w-full justify-center"
                    >
                      <Link
                        to="/sign-up"
                        search={DEFAULT_AUTH_SEARCH}
                        onClick={() => setIsOpen(false)}
                      >
                        {t('header.createAccount')}
                      </Link>
                    </Button>
                  </div>
                )}
              </nav>

              {isSignedIn && (
                <div className="mt-auto border-t border-slate-800/50 bg-slate-800/30 p-4">
                  <div className="flex items-center gap-3">
                    <UserButton afterSignOutUrl="/" />
                    <NotificationBell dropDirection="up" />
                    <span className="text-sm text-slate-400">{userName}</span>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
