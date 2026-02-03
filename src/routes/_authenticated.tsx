import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useEffect } from 'react'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
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
      return
    }

    // Redirect admins to admin panel
    if (profile?.role === 'room_admin') {
      navigate({ to: '/admin' })
    }
  }, [isLoaded, isSignedIn, profile, navigate])

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

  return <Outlet />
}
