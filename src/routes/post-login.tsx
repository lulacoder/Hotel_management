// Post-auth route that resolves user role and redirects to the correct destination.
import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from '@/integrations/convex/hooks'
import { api } from '../../convex/_generated/api'
import { sanitizeRedirect } from '../lib/authRouting'
import { Card, CardContent } from '../components/ui/card'
import { useI18n } from '../lib/i18n/provider'
import { DEFAULT_ADMIN_DASHBOARD_SEARCH } from '../lib/navigationSearch'

export const Route = createFileRoute('/post-login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  // Client-only transition page that decides the next destination after auth.
  ssr: false,
  component: PostLoginPage,
})

export function PostLoginPage() {
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md rounded-3xl border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <CardContent className="py-10 text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500" />
          <p className="text-lg text-slate-200">
            {t('postLogin.loadingProfile')}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {t('postLogin.settingUp')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
