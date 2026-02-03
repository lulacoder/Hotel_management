import {
  createFileRoute,
  Outlet,
  useNavigate,
  Link,
} from '@tanstack/react-router'
import { useUser, UserButton } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  Building,
  Settings,
  LogOut,
} from 'lucide-react'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const { user, isLoaded, isSignedIn } = useUser()
  const navigate = useNavigate()

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
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isSignedIn) {
    return null
  }

  // Access denied for non-admins
  if (profile?.role !== 'room_admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogOut className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">
            You don't have permission to access the admin area. This section is
            restricted to room administrators only.
          </p>
          <button
            onClick={() => navigate({ to: '/' })}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-800">Hotel Admin</h1>
          <p className="text-sm text-gray-500">Management Portal</p>
        </div>
        <nav className="p-4 space-y-2">
          <Link
            to="/admin"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <button
            disabled
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 cursor-not-allowed w-full"
          >
            <Building className="w-5 h-5" />
            Rooms (Coming Soon)
          </button>
          <button
            disabled
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 cursor-not-allowed w-full"
          >
            <Users className="w-5 h-5" />
            Bookings (Coming Soon)
          </button>
          <button
            disabled
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 cursor-not-allowed w-full"
          >
            <Settings className="w-5 h-5" />
            Settings (Coming Soon)
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        {/* Top Bar */}
        <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">
            Welcome back, {user?.firstName || 'Admin'}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {user?.emailAddresses[0]?.emailAddress}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
