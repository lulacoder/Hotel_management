import {
  createFileRoute,
  Outlet,
  useNavigate,
  Link,
  useLocation,
} from '@tanstack/react-router'
import { useUser, UserButton } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useEffect } from 'react'
import {
  LayoutDashboard,
  Building2,
  Hotel,
  Calendar,
  LogOut,
} from 'lucide-react'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const { user, isLoaded, isSignedIn } = useUser()
  const navigate = useNavigate()
  const location = useLocation()

  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      navigate({ to: '/sign-in' })
    }
  }, [isLoaded, isSignedIn, navigate])

  if (!isLoaded || profile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-500/20 border-t-amber-500"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-amber-500/10"></div>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return null
  }

  // Access denied for non-admins
  if (profile?.role !== 'room_admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="bg-slate-900 border border-red-500/20 rounded-2xl shadow-2xl shadow-red-500/5 p-10 max-w-md text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <LogOut className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-semibold text-red-400 mb-3 tracking-tight">
            Access Denied
          </h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            You don't have permission to access the admin area. This section is
            restricted to room administrators only.
          </p>
          <button
            onClick={() => navigate({ to: '/' })}
            className="px-8 py-3 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-all duration-200 border border-slate-700"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/admin/hotels', label: 'Hotels', icon: Hotel },
    { to: '/admin/rooms', label: 'Rooms', icon: Building2 },
    { to: '/admin/bookings', label: 'Bookings', icon: Calendar },
  ]

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900/50 border-r border-slate-800/50 backdrop-blur-xl">
        <div className="p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950/70 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <img
                src="/logo192.png"
                alt="Luxe Hotels"
                className="w-7 h-7 object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100 tracking-tight">
                Hotel Admin
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Management Portal
              </p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.to, item.exact)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  active
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                }`}
              >
                <item.icon
                  className={`w-5 h-5 ${active ? 'text-amber-400' : ''}`}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User section at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800/50 w-72">
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
                {user?.firstName || 'Admin'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user?.emailAddresses[0]?.emailAddress}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Page Content */}
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
