// Post-auth route that resolves user role and redirects to the correct destination.
import {
  Navigate,
  createFileRoute,
} from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { sanitizeRedirect } from '../lib/authRouting'
import { useI18n } from '../lib/i18n'
import { DEFAULT_ADMIN_DASHBOARD_SEARCH } from '../lib/navigationSearch'

export const Route = createFileRoute('/post-login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  // Client-only transition page that decides the next destination after auth.
  ssr: false,
  component: PostLoginPage,
})

function PostLoginPage() {
  // Pull auth/profile + redirect query params used for role-based routing.
  const { user, isLoaded: isClerkLoaded } = useUser()
  const search = Route.useSearch()
  const { t } = useI18n()

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  if (isClerkLoaded && !user) {
    return <Navigate to="/sign-in" search={search} />
  }

  if (
    isClerkLoaded &&
    profile &&
    (profile.role === 'room_admin' || hotelAssignment)
  ) {
    return <Navigate to="/admin" search={DEFAULT_ADMIN_DASHBOARD_SEARCH} />
  }

  if (
    isClerkLoaded &&
    profile &&
    hotelAssignment === null &&
    profile.role !== 'room_admin'
  ) {
    return <Navigate to={search.redirect ?? '/select-location'} />
  }

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
