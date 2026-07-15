// Public invitation handoff that preserves auth redirects and activates staff access.
import {
  Link,
  createFileRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  KeyRound,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'

import { api } from '../../../convex/_generated/api'
import { Button } from '../../components/ui/button'
import { ThemeToggle } from '../../components/ThemeToggle'
import { useI18n } from '../../lib/i18n/provider'
import { DEFAULT_ADMIN_DASHBOARD_SEARCH } from '../../lib/navigationSearch'
import { useTheme } from '../../lib/theme'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAction, useQuery } from '@/integrations/convex/hooks'

export const Route = createFileRoute('/staff-invitations/$invitationId')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  ssr: false,
  component: StaffInvitationPage,
})

function StaffInvitationPage() {
  const { invitationId } = Route.useParams()
  const convexInvitationId = invitationId as Id<'hotelStaffInvitations'>
  const search = Route.useSearch()
  const location = useLocation()
  const navigate = useNavigate({ from: Route.fullPath })
  const { user, isLoaded, isSignedIn } = useUser()
  const { t, locale } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')
  const invitation = useQuery(
    api.staffInvitations.getForRecipient,
    profile ? { invitationId: convexInvitationId } : 'skip',
  )
  const acceptInvitation = useAction(api.staffInvitationActions.accept)

  const redirectTarget = location.href
  const dateLocale = locale === 'am' ? 'am-ET' : 'en-US'

  const handleAccept = async () => {
    if (!search.token) return
    setAcceptError(null)
    setAccepting(true)
    try {
      await acceptInvitation({
        invitationId: convexInvitationId,
        token: search.token,
      })
      await navigate({
        to: '/admin',
        search: DEFAULT_ADMIN_DASHBOARD_SEARCH,
        replace: true,
      })
    } catch (error) {
      setAcceptError(
        error instanceof Error ? error.message : t('staffInvite.acceptFailed'),
      )
    } finally {
      setAccepting(false)
    }
  }

  let content: React.ReactNode

  if (!isLoaded) {
    content = <InvitationLoading label={t('staffInvite.loading')} />
  } else if (!isSignedIn) {
    content = (
      <InvitationState
        icon={KeyRound}
        eyebrow={t('staffInvite.eyebrow')}
        title={t('staffInvite.signInTitle')}
        description={t('staffInvite.signInDescription')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild size="lg">
            <Link to="/sign-in" search={{ redirect: redirectTarget }}>
              {t('staffInvite.signIn')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/sign-up" search={{ redirect: redirectTarget }}>
              {t('staffInvite.createAccount')}
            </Link>
          </Button>
        </div>
      </InvitationState>
    )
  } else if (profile === undefined || invitation === undefined) {
    content = <InvitationLoading label={t('staffInvite.checking')} />
  } else if (profile === null || invitation === null) {
    content = (
      <InvitationState
        icon={ShieldAlert}
        eyebrow={t('staffInvite.unavailableEyebrow')}
        title={t('staffInvite.unavailableTitle')}
        description={t('staffInvite.unavailableDescription')}
        tone="danger"
      />
    )
  } else if (invitation.status === 'expired') {
    content = (
      <InvitationState
        icon={CalendarClock}
        eyebrow={t('staffInvite.expiredEyebrow')}
        title={t('staffInvite.expiredTitle')}
        description={t('staffInvite.expiredDescription')}
        tone="warning"
      />
    )
  } else if (invitation.status === 'revoked') {
    content = (
      <InvitationState
        icon={ShieldAlert}
        eyebrow={t('staffInvite.revokedEyebrow')}
        title={t('staffInvite.revokedTitle')}
        description={t('staffInvite.revokedDescription')}
        tone="danger"
      />
    )
  } else if (invitation.status === 'accepted') {
    content = (
      <InvitationState
        icon={CheckCircle2}
        eyebrow={t('staffInvite.acceptedEyebrow')}
        title={t('staffInvite.acceptedTitle')}
        description={t('staffInvite.acceptedDescription')}
        tone="success"
      >
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/admin" search={DEFAULT_ADMIN_DASHBOARD_SEARCH}>
            {t('staffInvite.openDashboard')}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </InvitationState>
    )
  } else {
    content = (
      <div>
        <div className="mb-7 flex items-center gap-3">
          <div className="rounded-2xl border border-violet-500/25 bg-violet-500/10 p-3 text-violet-400">
            <MailCheck className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-400">
              {t('staffInvite.eyebrow')}
            </p>
            <h1
              className={`mt-1 text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {t('staffInvite.title')}
            </h1>
          </div>
        </div>

        <p
          className={`mb-6 leading-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
        >
          {t('staffInvite.description')}
        </p>

        <div
          className={`overflow-hidden rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-950/55' : 'border-slate-200 bg-slate-50'}`}
        >
          <InviteDetail
            icon={Building2}
            label={t('staffInvite.hotel')}
            value={`${invitation.hotelName}, ${invitation.hotelCity}`}
            isDark={isDark}
          />
          <InviteDetail
            icon={ShieldCheck}
            label={t('staffInvite.role')}
            value={t(
              invitation.role === 'hotel_admin'
                ? 'admin.role.hotelAdmin'
                : 'admin.role.hotelCashier',
            )}
            isDark={isDark}
          />
          <InviteDetail
            icon={CalendarClock}
            label={t('staffInvite.expires')}
            value={new Date(invitation.expiresAt).toLocaleString(dateLocale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            isDark={isDark}
          />
        </div>

        <div
          className={`mt-5 rounded-xl border px-4 py-3 text-sm ${isDark ? 'border-slate-800 bg-slate-900/50 text-slate-400' : 'border-slate-200 bg-white text-slate-600'}`}
        >
          {t('staffInvite.emailNotice', { email: invitation.email })}
        </div>

        {!search.token ? (
          <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {t('staffInvite.missingToken')}
          </p>
        ) : null}
        {acceptError ? (
          <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {acceptError}
          </p>
        ) : null}

        <Button
          type="button"
          size="lg"
          disabled={!search.token || accepting}
          onClick={() => void handleAccept()}
          className="mt-6 w-full"
        >
          {accepting ? t('staffInvite.accepting') : t('staffInvite.accept')}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <main
      className={`relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 size-80 rounded-full bg-violet-500/12 blur-3xl" />
        <div className="absolute -right-24 bottom-10 size-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div
          className={`absolute inset-0 opacity-[0.025] ${isDark ? 'bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)]' : 'bg-[radial-gradient(circle_at_center,_black_1px,_transparent_1px)]'} bg-[length:24px_24px]`}
        />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <Link to="/" className="brand-logo-shell flex h-10 items-center px-1">
            <img
              src="/logo.webp"
              alt="TripWays Hotels"
              className="h-8 w-auto object-contain logo-tight"
            />
          </Link>
          <ThemeToggle compact />
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <section
            className={`relative w-full max-w-xl overflow-hidden rounded-[28px] border p-6 shadow-2xl backdrop-blur-xl sm:p-9 ${isDark ? 'border-slate-800/80 bg-slate-900/85 shadow-black/35' : 'border-white/80 bg-white/90 shadow-slate-300/40'}`}
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-600 via-violet-400 to-indigo-500" />
            {content}
          </section>
        </div>

        <p
          className={`pb-2 text-center text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
        >
          {t('staffInvite.securityFooter')}
        </p>
      </div>
    </main>
  )
}

function InvitationLoading({ label }: { label: string }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto size-11 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500" />
      <p className="mt-5 text-sm text-slate-500">{label}</p>
    </div>
  )
}

function InvitationState({
  icon: Icon,
  eyebrow,
  title,
  description,
  tone = 'violet',
  children,
}: {
  icon: typeof ShieldCheck
  eyebrow: string
  title: string
  description: string
  tone?: 'violet' | 'warning' | 'danger' | 'success'
  children?: React.ReactNode
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const toneClass = {
    violet: 'border-violet-500/20 bg-violet-500/10 text-violet-400',
    warning: 'border-orange-500/20 bg-orange-500/10 text-orange-400',
    danger: 'border-red-500/20 bg-red-500/10 text-red-400',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  }[tone]

  return (
    <div className="py-4 text-center">
      <div
        className={`mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border ${toneClass}`}
      >
        <Icon className="size-8" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {eyebrow}
      </p>
      <h1
        className={`mt-2 text-2xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {title}
      </h1>
      <p
        className={`mx-auto mt-3 max-w-md text-sm leading-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
      >
        {description}
      </p>
      {children ? <div className="mt-7">{children}</div> : null}
    </div>
  )
}

function InviteDetail({
  icon: Icon,
  label,
  value,
  isDark,
}: {
  icon: typeof Building2
  label: string
  value: string
  isDark: boolean
}) {
  return (
    <div
      className={`flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
    >
      <Icon className="size-4 shrink-0 text-violet-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p
          className={`mt-1 truncate text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
