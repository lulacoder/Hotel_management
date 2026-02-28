// Admin layout route with role checks, sidebar navigation, and nested outlet rendering.
import {
  Link,
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
  Menu,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { ThemeToggle } from '../components/ThemeToggle'
import { useI18n } from '../lib/i18n'

export const Route = createFileRoute('/admin')({
  // Client-side guard: unauthenticated users are redirected to sign-in.
  beforeLoad: () => {
    if (typeof window !== 'undefined') {
      const clerk = (window as Window & { Clerk?: { user?: unknown } }).Clerk
      if (!clerk?.user) {
        throw redirect({ to: '/sign-in' })
      }
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { user, isLoaded, isSignedIn } = useUser()
  const { t } = useI18n()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // App-level profile (role, email, etc.)
  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  // Hotel-specific assignment determines scoped admin permissions.
  const hotelAssignment = useQuery(
    api.hotelStaff.getByUserId,
    user?.id && profile?._id
      ? { clerkUserId: user.id, userId: profile._id }
      : 'skip',
  )

  if (!isLoaded || profile === undefined) {
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
    return null
  }

  if (profile?.role !== 'room_admin' && hotelAssignment === undefined) {
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
  if (profile?.role !== 'room_admin' && !hotelAssignment) {
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
          <button
            onClick={() => (window.location.href = '/')}
            className="px-8 py-3 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-all duration-200 border border-slate-700"
          >
            {t('admin.returnHome')}
          </button>
        </div>
      </div>
    )
  }

  const navItems = [
    {
      to: '/admin',
      label: t('admin.nav.dashboard'),
      icon: LayoutDashboard,
      exact: true,
    },
    { to: '/admin/hotels', label: t('admin.nav.hotels'), icon: Hotel },
    { to: '/admin/rooms', label: t('admin.nav.rooms'), icon: Building2 },
    { to: '/admin/bookings', label: t('admin.nav.bookings'), icon: Calendar },
    { to: '/admin/walk-in', label: t('admin.nav.walkIn'), icon: UserPlus },
    { to: '/admin/users', label: t('admin.nav.users'), icon: Users },
  ]

  // Filter sidebar items by global role + hotel assignment role.
  const visibleNavItems = navItems.filter((item) => {
    if (item.to === '/admin/walk-in') {
      return (
        hotelAssignment?.role === 'hotel_cashier' ||
        hotelAssignment?.role === 'hotel_admin'
      )
    }

    if (profile?.role === 'room_admin') {
      return true
    }

    if (hotelAssignment?.role === 'hotel_cashier') {
      return (
        item.to === '/admin/bookings' ||
        item.to === '/admin/rooms' ||
        item.to === '/admin/walk-in'
      )
    }

    if (hotelAssignment?.role === 'hotel_admin') {
      return item.to !== '/admin/users'
    }

    return false
  })

  const isActive = (path: string, exact?: boolean) => {
    // Exact match for dashboard; prefix match for nested sections.
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex min-h-screen bg-slate-950 md:h-dvh md:overflow-hidden">
      {/* Mobile Menu Button - Only visible on small screens */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 group"
        aria-label={t('header.openMenu')}
      >
        <Menu
          size={22}
          className="text-slate-300 group-hover:text-blue-400 transition-colors"
        />
      </button>

      {/* Mobile Slide-out Menu */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-800/50 shadow-2xl z-50 transform transition-transform duration-500 ease-out flex flex-col ${
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
            const active = isActive(item.to, item.exact)
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  active
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                }`}
              >
                <item.icon
                  className={`w-5 h-5 ${active ? 'text-blue-400' : ''}`}
                />
                {item.label}
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
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      <div
        className={`md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-all duration-500 ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:h-dvh w-72 shrink-0 bg-slate-900/50 border-r border-slate-800/50 backdrop-blur-xl flex-col">
        <div className="p-6 border-b border-slate-800/50">
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

        <div className="px-6 py-4 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="w-full justify-center" />
            <ThemeToggle className="w-full justify-center" />
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const active = isActive(item.to, item.exact)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  active
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                }`}
              >
                <item.icon
                  className={`w-5 h-5 ${active ? 'text-blue-400' : ''}`}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User section at bottom */}
        <div className="mt-auto p-4 border-t border-slate-800/50">
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
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 flex-col">
        {/* Page Content */}
        <main className="flex-1 min-h-0 p-4 md:p-8 overflow-y-auto overflow-x-hidden md:mt-0 mt-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

