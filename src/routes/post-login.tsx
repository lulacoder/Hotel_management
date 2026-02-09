import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'


export const Route = createFileRoute('/post-login')({
  ssr: false,
  component: PostLoginPage,
})

function PostLoginPage() {
  const { user, isLoaded: isClerkLoaded } = useUser()
  const navigate = useNavigate()
  const location = useLocation()

  const params = new URLSearchParams(location.search)
  const redirectParam = params.get('redirect')
  const redirectTarget =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : null

  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  useEffect(() => {
    if (!isClerkLoaded) return

    if (!user) {
      navigate({ to: '/sign-in' })
      return
    }

    // Profile is still loading (undefined means loading, null means not found)
    if (profile === undefined) return

    if (profile) {
      if (profile.role === 'room_admin') {
        navigate({ to: '/admin' })
      } else {
        navigate({ to: redirectTarget || '/select-location' })
      }
    } else {
      // Profile not found yet - webhook might still be processing
      // Wait a bit and check again (handled by Convex reactivity)
      console.log('Waiting for user profile to be created...')
    }
  }, [isClerkLoaded, user, profile, navigate, redirectTarget])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Loading your profile...</p>
        <p className="text-gray-400 text-sm mt-2">
          Setting up your account, please wait...
        </p>
      </div>
    </div>
  )
}
