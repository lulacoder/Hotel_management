// Authenticated customer layout that redirects staff/admin users to the admin area.
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/_authenticated')({
  // Registers the protected parent layout route for customer pages.
  // Parent layout for customer-only authenticated pages.
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  // Gather auth state and profile data used for redirect decisions.
  const { user, isLoaded, isSignedIn } = useUser()
  const navigate = useNavigate()

  // Load app user profile mapped from the Clerk user id.
  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  // If present, user is staff/admin and should use admin area instead.
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  useEffect(() => {
    // Centralized redirect logic for signed-out and staff/admin users.
    // Wait for Clerk initialization before redirect decisions.
    if (!isLoaded) return

    if (!isSignedIn) {
      navigate({ to: '/sign-in' })
      return
    }

    // Staff/admin users are routed to the admin workspace.
    if (profile?.role === 'room_admin' || hotelAssignment) {
      navigate({ to: '/admin' })
    }
  }, [isLoaded, isSignedIn, profile, hotelAssignment, navigate])

  // Keep a neutral loader while profile query resolves.
  if (!isLoaded || profile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Redirect effect will handle this case.
  if (!isSignedIn) {
    return null
  }

  return <Outlet />
}
