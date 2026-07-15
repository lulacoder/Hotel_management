import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
} from '@tanstack/react-router'
import { UserButton, useUser } from '@clerk/clerk-react'
import { useState } from 'react'
import {
  Building2,
  Calendar,
  Hotel,
  LayoutDashboard,
  LogOut,
  MailPlus,
  Megaphone,
  Menu,
  MessageSquareText,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { MobileAccountActions } from '../components/MobileAccountActions'
import { ThemeToggle } from '../components/ThemeToggle'
import { NotificationBell } from '../components/NotificationBell'
import { AdminSessionProvider } from '../lib/adminSession'
import { useI18n } from '../lib/i18n/provider'
import { useTheme } from '../lib/theme'
import { buildRedirectSearch } from '../lib/authRouting'
import {
  DEFAULT_ADMIN_DASHBOARD_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../lib/navigationSearch'
import { useQuery } from '@/integrations/convex/hooks'

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ context, location }) => {
    const auth = context.auth.getClientSnapshot()

    if (auth.isLoaded && !auth.isSignedIn) {
      throw redirect({
        to: '/sign-in',
        search: buildRedirectSearch(location.href),
      })
    }
  },
  ssr: false,
  component: AdminLayout,
})

interface AdminNavItem {
  exact?: boolean
  icon: typeof LayoutDashboard
  key: string
  to:
    | '/admin'
    | '/admin/announcements'
    | '/admin/bookings'
    | '/admin/complaints'
    | '/admin/hotels'
    | '/admin/invitations'
    | '/admin/rooms'
    | '/admin/users'
    | '/admin/walk-in'
}

const ADMIN_NAV_ITEMS: Array<AdminNavItem> = [
  {
    exact: true,
    icon: LayoutDashboard,
    key: 'dashboard',
    to: '/admin',
  },
  {
    icon: Hotel,
    key: 'hotels',
    to: '/admin/hotels',
  },
  {
    icon: Building2,
    key: 'rooms',
    to: '/admin/rooms',
  },
  {
    icon: Calendar,
    key: 'bookings',
    to: '/admin/bookings',
  },
  {
    icon: MessageSquareText,
    key: 'complaints',
    to: '/admin/complaints',
  },
  {
    icon: UserPlus,
    key: 'walkIn',
    to: '/admin/walk-in',
  },
  {
    icon: Users,
    key: 'users',
    to: '/admin/users',
  },
  {
    icon: MailPlus,
    key: 'invitations',
    to: '/admin/invitations',
  },
  {
    icon: Megaphone,
    key: 'announcements',
    to: '/admin/announcements',
  },
]

function AdminLayout() {
  const { user, isLoaded, isSignedIn } = useUser()
  const location = useLocation()
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // App-level profile (role, email, etc.)
  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  // Hotel-specific assignment determines scoped admin permissions.
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )
  const isRoomAdmin = profile?.role === 'room_admin'
  const hotelAssignmentRole = hotelAssignment?.role ?? null

  if (!isLoaded || profile === undefined || profile === null) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
      >
        <div className="relative">
          <div className="animate-spin rounded-full size-12 border-2 border-violet-500/20 border-t-violet-500"></div>
          <div className="absolute inset-0 animate-ping rounded-full size-12 border border-violet-500/10"></div>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <Navigate to="/sign-in" search={buildRedirectSearch(location.href)} />
    )
  }

  if (!isRoomAdmin && hotelAssignment === undefined) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
      >
        <div className="relative">
          <div className="animate-spin rounded-full size-12 border-2 border-violet-500/20 border-t-violet-500"></div>
          <div className="absolute inset-0 animate-ping rounded-full size-12 border border-violet-500/10"></div>
        </div>
      </div>
    )
  }

  // Access denied for users without admin role or hotel staff assignment
  if (!isRoomAdmin && !hotelAssignment) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
      >
        <div
          className={`rounded-2xl shadow-2xl p-10 max-w-md text-center border border-red-500/20 ${
            isDark
              ? 'bg-slate-900 shadow-red-500/5'
              : 'bg-white shadow-slate-300/30'
          }`}
        >
          <div className="size-20 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <LogOut className="size-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-semibold text-red-400 mb-3 tracking-tight">
            {t('admin.accessDenied')}
          </h1>
          <p
            className={`mb-8 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          >
            {t('admin.accessDeniedDescription')}
          </p>
          <Link
            to="/select-location"
            search={DEFAULT_SELECT_LOCATION_SEARCH}
            className={`inline-flex rounded-xl border px-8 py-3 font-medium transition-all duration-200 ${
              isDark
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t('admin.returnHome')}
          </Link>
        </div>
      </div>
    )
  }

  // Filter sidebar items by global role + hotel assignment role.
  const visibleNavItems = ADMIN_NAV_ITEMS.filter((item) => {
    switch (item.to) {
      case '/admin/walk-in':
      case '/admin/announcements':
        return (
          hotelAssignmentRole === 'hotel_cashier' ||
          hotelAssignmentRole === 'hotel_admin'
        )
      case '/admin/complaints':
        return (
          hotelAssignmentRole === 'hotel_cashier' ||
          hotelAssignmentRole === 'hotel_admin'
        )
      case '/admin/hotels':
        return isRoomAdmin || hotelAssignmentRole === 'hotel_admin'
      case '/admin/users':
        return isRoomAdmin
      case '/admin/invitations':
        return isRoomAdmin || hotelAssignmentRole === 'hotel_admin'
      case '/admin':
      case '/admin/bookings':
      case '/admin/rooms':
        return (
          isRoomAdmin ||
          hotelAssignmentRole === 'hotel_cashier' ||
          hotelAssignmentRole === 'hotel_admin'
        )
      default:
        return false
    }
  })

  return (
    <div
      className={`flex min-h-screen md:h-dvh md:overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
    >
      {/* Mobile Menu Button - Only visible on small screens */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden fixed top-4 left-4 z-[80] p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 group"
        aria-label={t('header.openMenu')}
      >
        <Menu
          size={22}
          className="text-slate-300 group-hover:text-violet-400 transition-colors"
        />
      </button>

      {/* Mobile Slide-out Menu */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-80 border-r shadow-2xl z-[75] transform transition-transform duration-500 ease-out flex flex-col ${
          isDark
            ? 'bg-slate-900 border-slate-800/50'
            : 'bg-white border-slate-200'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`flex items-center justify-between p-5 border-b ${
            isDark ? 'border-slate-800/50' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="brand-logo-shell h-10 px-1 flex items-center justify-center">
              <img
                src="/logo.webp"
                alt="Luxe Hotels"
                className="h-8 w-auto object-contain logo-tight"
              />
            </div>
            <div>
              <h2
                className={`text-lg font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
              >
                {t('admin.hotelAdmin')}
              </h2>
              <p
                className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
              >
                {t('admin.navigationMenu')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
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
                  : 'text-slate-500 group-hover:text-slate-900'
              }`}
            />
          </button>
        </div>

        <div
          className={`px-5 py-4 border-b ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}
        >
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact className="shrink-0" />
            <ThemeToggle
              labelMode="control"
              className="min-w-[7.25rem] shrink-0 justify-center"
            />
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto space-y-1">
          {visibleNavItems.map((item) => {
            return (
              <Link
                key={item.to}
                to={item.to}
                search={
                  item.to === '/admin'
                    ? DEFAULT_ADMIN_DASHBOARD_SEARCH
                    : undefined
                }
                onClick={() => setMobileMenuOpen(false)}
                activeOptions={{ exact: item.exact }}
                activeProps={{
                  className:
                    'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 bg-violet-500/10 text-violet-500 border border-violet-500/20',
                }}
                inactiveProps={{
                  className: isDark
                    ? 'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                    : 'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-transparent',
                }}
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`size-5 ${isActive ? 'text-violet-400' : ''}`}
                    />
                    {t(`admin.nav.${item.key}` as never)}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        <div
          className={`p-4 border-t ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}
        >
          <MobileAccountActions
            displayName={user.firstName || t('admin.defaultUserName')}
            email={user.emailAddresses[0]?.emailAddress}
            isDark={isDark}
            onRequestClose={() => setMobileMenuOpen(false)}
            showNotifications
          />
        </div>
      </aside>

      {/* Mobile Backdrop */}
      <button
        type="button"
        aria-label={t('header.closeMenu')}
        className={`md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] transition-all duration-500 ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex md:h-dvh w-[17rem] shrink-0 border-r backdrop-blur-xl flex-col relative z-20 ${
          isDark
            ? 'bg-slate-900/50 border-slate-800/50'
            : 'bg-white/85 border-slate-200'
        }`}
      >
        <div
          className={`p-5 border-b ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}
        >
          <div className="flex items-center gap-3">
            <div className="brand-logo-shell h-10 px-1 flex items-center justify-center">
              <img
                src="/logo.webp"
                alt="Luxe Hotels"
                className="h-8 w-auto object-contain logo-tight"
              />
            </div>
            <div>
              <h1
                className={`text-lg font-semibold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
              >
                {t('admin.hotelAdmin')}
              </h1>
              <p
                className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
              >
                {t('admin.managementPortal')}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`px-5 py-3.5 border-b ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}
        >
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact className="shrink-0" />
            <ThemeToggle
              labelMode="control"
              className="min-w-[7.25rem] shrink-0 justify-center"
            />
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {visibleNavItems.map((item) => {
            return (
              <Link
                key={item.to}
                to={item.to}
                search={
                  item.to === '/admin'
                    ? DEFAULT_ADMIN_DASHBOARD_SEARCH
                    : undefined
                }
                activeOptions={{ exact: item.exact }}
                activeProps={{
                  className:
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 bg-violet-500/10 text-violet-500 border border-violet-500/20',
                }}
                inactiveProps={{
                  className: isDark
                    ? 'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                    : 'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-transparent',
                }}
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`size-5 ${isActive ? 'text-violet-400' : ''}`}
                    />
                    {t(`admin.nav.${item.key}` as never)}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User section at bottom */}
        <div
          className={`p-3 border-t ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}
        >
          <div className="flex items-center gap-2.5 px-1.5">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'size-8',
                },
              }}
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-[13px] font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
              >
                {user.firstName || t('admin.defaultUserName')}
              </p>
              <p
                className={`text-[11px] truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
              >
                {user.emailAddresses[0]?.emailAddress}
              </p>
            </div>
            <NotificationBell dropDirection="up" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 flex-col">
        {/* Page Content */}
        <main className="relative z-0 flex-1 min-h-0 p-4 md:p-8 overflow-y-auto overflow-x-hidden md:mt-0 mt-12">
          <AdminSessionProvider
            value={{
              displayName:
                user.firstName ||
                user.emailAddresses[0]?.emailAddress ||
                t('admin.defaultUserName'),
              hotelAssignment: hotelAssignment ?? null,
              hotelAssignmentRole,
              isRoomAdmin,
              profile,
            }}
          >
            <Outlet />
          </AdminSessionProvider>
        </main>
      </div>
    </div>
  )
}
