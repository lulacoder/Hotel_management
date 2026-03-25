// Authenticated customer layout that redirects staff/admin users to the admin area.
import {
  Navigate,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
} from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { buildRedirectSearch } from '../lib/authRouting'
import { DEFAULT_ADMIN_DASHBOARD_SEARCH } from '../lib/navigationSearch'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    const auth = context.auth.getClientSnapshot()

    if (auth.isLoaded && !auth.isSignedIn) {
      throw redirect({
        to: '/sign-in',
        search: buildRedirectSearch(location.href),
      })
    }

    if (auth.globalRole === 'room_admin') {
      throw redirect({ to: '/admin', search: DEFAULT_ADMIN_DASHBOARD_SEARCH })
    }
  },
  // Registers the protected parent layout route for customer pages.
  // Parent layout for customer-only authenticated pages.
  ssr: false,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  // Gather auth state and profile data used for redirect decisions.
  const { user, isLoaded, isSignedIn } = useUser()
  const location = useLocation()

  // Load app user profile mapped from the Clerk user id.
  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  // If present, user is staff/admin and should use admin area instead.
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  // Keep a neutral loader while profile query resolves.
  if (!isLoaded || profile === undefined || profile === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <Navigate
        to="/sign-in"
        search={buildRedirectSearch(location.href)}
      />
    )
  }

  if (profile.role === 'room_admin' || hotelAssignment) {
    return <Navigate to="/admin" search={DEFAULT_ADMIN_DASHBOARD_SEARCH} />
  }

  return <Outlet />
}
