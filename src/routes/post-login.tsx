// Post-auth route that resolves user role and redirects to the correct destination.
import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { sanitizeRedirect } from '../lib/authRouting'
import { Card, CardContent } from '../components/ui/card'
import { useI18n } from '../lib/i18n/provider'
import {
  getStaffInvitationContinuation,
  isStaffInvitationRedirect,
} from '../lib/staffInvitationContinuation'
import { useQuery } from '@/integrations/convex/hooks'

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
  const [storedInvitationRedirect] = useState(() =>
    getStaffInvitationContinuation(),
  )
  const resolvedRedirect = search.redirect ?? storedInvitationRedirect

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  const redirectedRef = useRef(false)

  useEffect(() => {
    if (redirectedRef.current) return
    if (!isClerkLoaded) return

    if (!user) {
      redirectedRef.current = true
      const searchParam = search.redirect
        ? `?redirect=${encodeURIComponent(search.redirect)}`
        : ''
      window.location.replace(`/sign-in${searchParam}`)
      return
    }

    if (profile === undefined) return

    if (isStaffInvitationRedirect(resolvedRedirect)) {
      redirectedRef.current = true
      window.location.replace(resolvedRedirect)
      return
    }

    if (profile && (profile.role === 'room_admin' || hotelAssignment)) {
      redirectedRef.current = true
      window.location.replace('/admin')
      return
    }

    if (profile && hotelAssignment === null && profile.role !== 'room_admin') {
      redirectedRef.current = true
      window.location.replace(search.redirect || '/select-location')
    }
  }, [
    isClerkLoaded,
    user,
    profile,
    hotelAssignment,
    resolvedRedirect,
    search.redirect,
  ])

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
