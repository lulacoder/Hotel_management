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
  Megaphone,
  Menu,
  MessageSquareText,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { ThemeToggle } from '../components/ThemeToggle'
import { NotificationBell } from '../components/NotificationBell'
import { useI18n } from '../lib/i18n'
import { buildRedirectSearch } from '../lib/authRouting'
import {
  DEFAULT_ADMIN_DASHBOARD_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../lib/navigationSearch'

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
    icon: Megaphone,
    key: 'announcements',
    to: '/admin/announcements',
  },
]

function AdminLayout() {
  const { user, isLoaded, isSignedIn } = useUser()
  const location = useLocation()
  const { t } = useI18n()
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500/20 border-t-blue-500"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-blue-500/10"></div>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" search={buildRedirectSearch(location.href)} />
  }

  if (!isRoomAdmin && hotelAssignment === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500/20 border-t-blue-500"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-blue-500/10"></div>
        </div>
      </div>
    )
  }

  // Access denied for users without admin role or hotel staff assignment
  if (!isRoomAdmin && !hotelAssignment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="bg-slate-900 border border-red-500/20 rounded-2xl shadow-2xl shadow-red-500/5 p-10 max-w-md text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <LogOut className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-semibold text-red-400 mb-3 tracking-tight">
            {t('admin.accessDenied')}
          </h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            {t('admin.accessDeniedDescription')}
          </p>
          <Link
            to="/select-location"
            search={DEFAULT_SELECT_LOCATION_SEARCH}
            className="inline-flex rounded-xl border border-slate-700 bg-slate-800 px-8 py-3 font-medium text-slate-200 transition-all duration-200 hover:bg-slate-700"
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
          isRoomAdmin ||
          hotelAssignmentRole === 'hotel_cashier' ||
          hotelAssignmentRole === 'hotel_admin'
        )
      case '/admin/hotels':
        return isRoomAdmin || hotelAssignmentRole === 'hotel_admin'
      case '/admin/users':
        return isRoomAdmin
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
    <div className="flex min-h-screen bg-slate-950 md:h-dvh md:overflow-hidden">
      {/* Mobile Menu Button - Only visible on small screens */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden fixed top-4 left-4 z-[80] p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 group"
        aria-label={t('header.openMenu')}
      >
        <Menu
          size={22}
          className="text-slate-300 group-hover:text-blue-400 transition-colors"
        />
      </button>

      {/* Mobile Slide-out Menu */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-800/50 shadow-2xl z-[75] transform transition-transform duration-500 ease-out flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
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
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                {t('admin.hotelAdmin')}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {t('admin.navigationMenu')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2.5 hover:bg-white/5 rounded-xl transition-all duration-300 group"
            aria-label={t('header.closeMenu')}
          >
            <X
              size={22}
              className="text-slate-400 group-hover:text-white transition-colors"
            />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="w-full justify-center" />
            <ThemeToggle className="w-full justify-center" />
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
                    'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 bg-blue-500/10 text-blue-400 border border-blue-500/20',
                }}
                inactiveProps={{
                  className:
                    'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent',
                }}
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`h-5 w-5 ${isActive ? 'text-blue-400' : ''}`}
                    />
                    {t(`admin.nav.${item.key}` as never)}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <div className="flex items-center gap-3 px-2">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9',
                },
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">
                {user.firstName || t('admin.defaultUserName')}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user.emailAddresses[0]?.emailAddress}
              </p>
            </div>
            <NotificationBell dropDirection="up" />
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      <div
        className={`md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] transition-all duration-500 ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:h-dvh w-[17rem] shrink-0 bg-slate-900/50 border-r border-slate-800/50 backdrop-blur-xl flex-col relative z-20">
        <div className="p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-10 rounded-xl bg-slate-950/70 border border-blue-500/30 px-1 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <img
                src="/logo.png"
                alt="Luxe Hotels"
                className="h-8 w-auto object-contain logo-tight"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100 tracking-tight">
                {t('admin.hotelAdmin')}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {t('admin.managementPortal')}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="w-full justify-center" />
            <ThemeToggle className="w-full justify-center" />
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
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 bg-blue-500/10 text-blue-400 border border-blue-500/20',
                }}
                inactiveProps={{
                  className:
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent',
                }}
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`h-5 w-5 ${isActive ? 'text-blue-400' : ''}`}
                    />
                    {t(`admin.nav.${item.key}` as never)}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User section at bottom */}
        <div className="p-3 border-t border-slate-800/50">
          <div className="flex items-center gap-2.5 px-1.5">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8',
                },
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-slate-200 truncate">
                {user.firstName || t('admin.defaultUserName')}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
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
          <Outlet />
        </main>
      </div>
    </div>
  )
}
