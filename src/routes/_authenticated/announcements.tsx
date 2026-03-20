import { Link, createFileRoute } from '@tanstack/react-router'
import { UserButton, useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Home,
  Info,
  MapPin,
  Megaphone,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { api } from '../../../convex/_generated/api'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { ThemeToggle } from '../../components/ThemeToggle'
import { useI18n } from '../../lib/i18n'
import { useTheme } from '../../lib/theme'
import type { Id } from '../../../convex/_generated/dataModel'

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/_authenticated/announcements')({
  validateSearch: (search: Record<string, unknown>) => ({
    hotelId: (search.hotelId as string | undefined) ?? '',
  }),
  component: CustomerAnnouncementsPage,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Priority = 'normal' | 'important' | 'urgent'

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

const priorityConfig: Record<
  Priority,
  {
    icon: typeof Megaphone
    labelKey: string
    cardBg: string
    cardBorder: string
    badgeBg: string
    badgeText: string
    iconColor: string
    barColor: string
  }
> = {
  urgent: {
    icon: AlertTriangle,
    labelKey: 'announcements.priority.urgent',
    cardBg: 'bg-red-500/5 dark:bg-red-500/5',
    cardBorder: 'border-red-500/25',
    badgeBg: 'bg-red-500/15',
    badgeText: 'text-red-400',
    iconColor: 'text-red-400',
    barColor: 'bg-red-500',
  },
  important: {
    icon: AlertCircle,
    labelKey: 'announcements.priority.important',
    cardBg: 'bg-amber-500/5',
    cardBorder: 'border-amber-500/25',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    iconColor: 'text-amber-400',
    barColor: 'bg-amber-500',
  },
  normal: {
    icon: Info,
    labelKey: 'announcements.priority.normal',
    cardBg: 'bg-slate-800/40',
    cardBorder: 'border-slate-700/60',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-400',
    iconColor: 'text-blue-400',
    barColor: 'bg-blue-500',
  },
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function CustomerAnnouncementsPage() {
  const { hotelId } = Route.useSearch()
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const hotel = useQuery(
    api.hotels.get,
    hotelId ? { hotelId: hotelId as Id<'hotels'> } : 'skip',
  )

  const announcements = useQuery(
    api.announcements.getActiveAnnouncementsForHotel,
    hotelId ? { hotelId: hotelId as Id<'hotels'> } : 'skip',
  )

  const { user, isSignedIn } = useUser()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const isLoading = announcements === undefined

  return (
    <div
      className={`min-h-screen bg-gradient-to-b ${
        isDark
          ? 'from-slate-950 via-slate-900 to-slate-950'
          : 'from-slate-50 via-white to-slate-100'
      }`}
    >
      {/* Header */}
      <header
        className={`backdrop-blur-xl border-b sticky top-0 z-50 ${
          isDark
            ? 'bg-slate-900/80 border-slate-800/50'
            : 'bg-white/85 border-slate-200/80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          {/* Left: back link */}
          <Link
            to={hotelId ? '/hotels/$hotelId' : '/'}
            params={hotelId ? { hotelId } : undefined}
            search={hotelId ? { resumeBookingId: undefined } : undefined}
            className={`flex items-center gap-2 transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden md:inline">
              {hotelId
                ? (hotel?.name ?? t('hotel.backToHotels'))
                : t('header.home')}
            </span>
          </Link>

          {/* Desktop right-side actions */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher compact />
            <ThemeToggle compact />
            {isSignedIn ? (
              <>
                <Link
                  to="/bookings"
                  className="px-3 py-1.5 text-sm font-semibold text-slate-900 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors"
                >
                  {t('header.myBookings')}
                </Link>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <Link
                  to="/sign-in"
                  className={`transition-colors font-medium ${
                    isDark
                      ? 'text-slate-400 hover:text-blue-400'
                      : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  {t('header.signIn')}
                </Link>
                <Link
                  to="/sign-up"
                  className="px-3 py-1.5 bg-blue-500 text-slate-900 font-semibold rounded-lg hover:bg-blue-400 transition-colors"
                >
                  {t('header.signUp')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile right-side */}
          <div className="flex md:hidden items-center gap-3">
            <LanguageSwitcher compact />
            {isSignedIn && (
              <Link
                to="/bookings"
                className="px-3 py-1.5 text-sm font-semibold text-slate-900 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors"
              >
                {t('header.myBookings')}
              </Link>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={`p-2.5 rounded-xl transition-all duration-300 group ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}
              aria-label={t('header.openMenu')}
            >
              <Menu
                size={22}
                className={`group-hover:text-blue-400 transition-colors ${
                  isDark ? 'text-slate-300' : 'text-slate-600'
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-out Menu */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 border-r shadow-2xl z-[60] transform transition-transform duration-500 ease-out flex flex-col ${
          isDark
            ? 'bg-slate-900 border-slate-800/50'
            : 'bg-white border-slate-200'
        } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`flex items-center justify-between p-5 border-b ${
            isDark ? 'border-slate-800/50' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 rounded-xl bg-slate-950/70 border border-blue-500/30 px-1 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-8 w-auto object-contain logo-tight"
              />
            </div>
            <p
              className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
            >
              {t('header.navigationMenu')}
            </p>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className={`p-2.5 rounded-xl transition-all duration-300 group ${
              isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'
            }`}
            aria-label={t('header.closeMenu')}
          >
            <X
              size={22}
              className={`transition-colors ${
                isDark
                  ? 'text-slate-400 group-hover:text-white'
                  : 'text-slate-500 group-hover:text-slate-800'
              }`}
            />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Home
                size={20}
                className="group-hover:text-blue-400 transition-colors"
              />
              <span className="font-medium">{t('header.home')}</span>
            </Link>

            <Link
              to="/select-location"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MapPin
                size={20}
                className="group-hover:text-blue-400 transition-colors"
              />
              <span className="font-medium">{t('header.browseLocations')}</span>
            </Link>
          </div>

          <div
            className={`mt-6 pt-6 border-t ${
              isDark ? 'border-slate-800/50' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <ThemeToggle />
            </div>
          </div>

          {!isSignedIn && (
            <div
              className={`mt-6 pt-6 border-t ${
                isDark ? 'border-slate-800/50' : 'border-slate-200'
              }`}
            >
              <p
                className={`text-xs font-medium uppercase tracking-wider mb-3 px-4 ${
                  isDark ? 'text-slate-500' : 'text-slate-500'
                }`}
              >
                {t('header.account')}
              </p>
              <div className="space-y-2">
                <Link
                  to="/sign-in"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all duration-300 font-medium ${
                    isDark
                      ? 'text-slate-300 border-slate-700 hover:border-slate-600 hover:bg-white/5'
                      : 'text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {t('header.signIn')}
                </Link>
                <Link
                  to="/sign-up"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25"
                >
                  {t('header.createAccount')}
                </Link>
              </div>
            </div>
          )}
        </nav>

        {isSignedIn && (
          <div
            className={`p-4 border-t ${
              isDark
                ? 'border-slate-800/50 bg-slate-800/30'
                : 'border-slate-200 bg-slate-50/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <span
                className={`text-sm ${
                  isDark ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                {user.firstName}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] transition-all duration-500 ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                         */}
      {/* ------------------------------------------------------------------ */}
      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Megaphone className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1
                className={`text-2xl font-semibold tracking-tight ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {t('announcements.pageTitle')}
              </h1>
              {hotel && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Building2
                    size={13}
                    className={isDark ? 'text-slate-500' : 'text-slate-500'}
                  />
                  <p
                    className={`text-sm ${
                      isDark ? 'text-slate-400' : 'text-slate-700'
                    }`}
                  >
                    {hotel.name}
                  </p>
                  <span
                    className={isDark ? 'text-slate-700' : 'text-slate-300'}
                  >
                    ·
                  </span>
                  <p
                    className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
                  >
                    {hotel.city}, {hotel.country}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-500" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && announcements.length === 0 && (
          <div
            className={`border rounded-2xl p-14 text-center ${
              isDark
                ? 'bg-slate-900/50 border-slate-800/50'
                : 'bg-white/80 border-slate-200/80 shadow-sm backdrop-blur-sm'
            }`}
          >
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                isDark ? 'bg-slate-800' : 'bg-slate-100'
              }`}
            >
              <Megaphone
                className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
              />
            </div>
            <h2
              className={`text-lg font-semibold mb-2 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {t('announcements.noneYet')}
            </h2>
            <p
              className={`text-sm max-w-xs mx-auto leading-relaxed ${
                isDark ? 'text-slate-500' : 'text-slate-500'
              }`}
            >
              {t('announcements.noneYetHint')}
            </p>
          </div>
        )}

        {/* Announcement feed */}
        {!isLoading && announcements.length > 0 && (
          <div className="space-y-4">
            {announcements.map((ann) => {
              const cfg = priorityConfig[ann.priority as Priority]
              const Icon = cfg.icon

              return (
                <article
                  key={ann._id}
                  className={`relative rounded-2xl border overflow-hidden transition-colors ${
                    isDark
                      ? `${cfg.cardBg} ${cfg.cardBorder}`
                      : ann.priority === 'urgent'
                        ? 'bg-red-50/70 border-red-200'
                        : ann.priority === 'important'
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-white/80 border-slate-200/80 shadow-sm backdrop-blur-sm'
                  }`}
                >
                  {/* Priority accent bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.barColor}`}
                  />

                  <div className="pl-5 pr-5 py-5">
                    {/* Badge row */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide ${cfg.badgeBg} ${cfg.badgeText}`}
                      >
                        <Icon size={11} />
                        {t(cfg.labelKey as Parameters<typeof t>[0])}
                      </span>
                      <time
                        className={`text-xs shrink-0 ${
                          isDark ? 'text-slate-500' : 'text-slate-500'
                        }`}
                        dateTime={new Date(ann.createdAt).toISOString()}
                      >
                        {timeAgo(ann.createdAt)}
                      </time>
                    </div>

                    {/* Title */}
                    <h3
                      className={`text-base font-semibold mb-2 leading-snug ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      {ann.title}
                    </h3>

                    {/* Body */}
                    <p
                      className={`text-sm leading-relaxed whitespace-pre-wrap ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      {ann.body}
                    </p>

                    {/* Footer */}
                    <div
                      className={`flex items-center gap-1.5 mt-4 pt-3 border-t ${
                        isDark ? 'border-slate-700/40' : 'border-slate-200'
                      }`}
                    >
                      <Building2
                        size={11}
                        className={isDark ? 'text-slate-600' : 'text-slate-500'}
                      />
                      <span
                        className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
                      >
                        {t('announcements.from')}
                      </span>
                      {ann.updatedAt !== ann.createdAt && (
                        <>
                          <span
                            className={`text-xs ${
                              isDark ? 'text-slate-700' : 'text-slate-300'
                            }`}
                          >
                            ·
                          </span>
                          <span
                            className={`text-xs ${
                              isDark ? 'text-slate-600' : 'text-slate-500'
                            }`}
                          >
                            {t('admin.announcements.updatedAt')}{' '}
                            {timeAgo(ann.updatedAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
