// Post-auth route that resolves user role and redirects to the correct destination.
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'
import { useI18n } from '../lib/i18n'

export const Route = createFileRoute('/post-login')({
  // Client-only transition page that decides the next destination after auth.
  ssr: false,
  component: PostLoginPage,
})

function PostLoginPage() {
  // Pull auth/profile + redirect query params used for role-based routing.
  const { user, isLoaded: isClerkLoaded } = useUser()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const params = new URLSearchParams(location.search)
  const redirectParam = params.get('redirect')
  const redirectTarget =
    redirectParam &&
    redirectParam.startsWith('/') &&
    !redirectParam.startsWith('//')
      ? redirectParam
      : null

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  useEffect(() => {
    // Route users based on role/assignment once all required queries resolve.
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
        return
      }

      if (hotelAssignment === undefined) {
        return
      }

      if (hotelAssignment) {
        navigate({ to: '/admin' }) // Redirect to admin dashboard if hotel assignment is found  
      } else {
        navigate({ to: redirectTarget || '/select-location' })
      }
    } else {
      // Profile not found yet - webhook might still be processing
      // Wait a bit and check again (handled by Convex reactivity)
      console.log('Waiting for user profile to be created...')
    }
  }, [isClerkLoaded, user, profile, hotelAssignment, navigate, redirectTarget])// this effect runs whenever any of the dependencies change, which includes the loading states and query results. It ensures that the user is redirected to the appropriate page based on their role and hotel assignment once all necessary data is available.

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">{t('postLogin.loadingProfile')}</p>
        <p className="text-gray-400 text-sm mt-2">{t('postLogin.settingUp')}</p>
      </div>
    </div>
  )
}
