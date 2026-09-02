// Hotel staff invitation management with role-scoped creation and history.
import { createFileRoute } from '@tanstack/react-router'
import {
  Ban,
  Building2,
  CheckCircle2,
  Clock3,
  MailPlus,
  MailWarning,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { api } from '../../../../convex/_generated/api'
import { Button } from '../../../components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { useConfirm } from '../../../components/ui/confirm-dialog'
import { useAdminSession } from '../../../lib/adminSession'
import { useI18n } from '../../../lib/i18n/provider'
import { useTheme } from '../../../lib/theme'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { TranslationKey } from '../../../lib/i18n/messages'
import { useAction, useMutation, useQuery } from '@/integrations/convex/hooks'

export const Route = createFileRoute('/admin/invitations/')({
  component: AdminInvitationsPage,
})

type InvitationStatus = 'pending' | 'expired' | 'accepted' | 'revoked'
type StaffRole = 'hotel_admin' | 'hotel_cashier'

const STATUS_META: Record<
  InvitationStatus,
  { icon: typeof Clock3; className: string; label: TranslationKey }
> = {
  pending: {
    icon: Clock3,
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    label: 'admin.invitations.status.pending',
  },
  expired: {
    icon: MailWarning,
    className: 'border-orange-500/25 bg-orange-500/10 text-orange-400',
    label: 'admin.invitations.status.expired',
  },
  accepted: {
    icon: CheckCircle2,
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    label: 'admin.invitations.status.accepted',
  },
  revoked: {
    icon: Ban,
    className: 'border-slate-500/25 bg-slate-500/10 text-slate-400',
    label: 'admin.invitations.status.revoked',
  },
}

function AdminInvitationsPage() {
  const { t, locale } = useI18n()
  const confirm = useConfirm()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { isRoomAdmin, hotelAssignment } = useAdminSession()
  const canManage = isRoomAdmin || hotelAssignment?.role === 'hotel_admin'
  const [email, setEmail] = useState('')
  const [selectedHotelId, setSelectedHotelId] = useState('')
  const [role, setRole] = useState<StaffRole>('hotel_admin')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | InvitationStatus>(
    'all',
  )
  const [submitting, setSubmitting] = useState(false)
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null)

  const invitations = useQuery(
    api.staffInvitations.listScoped,
    canManage ? {} : 'skip',
  )
  const hotels = useQuery(api.hotels.list, isRoomAdmin ? {} : 'skip')
  const assignedHotel = useQuery(
    api.hotels.get,
    !isRoomAdmin && hotelAssignment
      ? { hotelId: hotelAssignment.hotelId }
      : 'skip',
  )
  const createInvitation = useAction(api.staffInvitationActions.create)
  const resendInvitation = useAction(api.staffInvitationActions.resend)
  const revokeInvitation = useMutation(api.staffInvitations.revoke)

  const effectiveHotelId = isRoomAdmin
    ? selectedHotelId
    : (hotelAssignment?.hotelId ?? '')
  const effectiveRole: StaffRole = isRoomAdmin ? role : 'hotel_cashier'
  const dateLocale = locale === 'am' ? 'am-ET' : 'en-US'

  const filteredInvitations = useMemo(() => {
    if (!invitations) return []
    const normalizedSearch = search.trim().toLowerCase()
    return invitations.filter((invitation) => {
      const matchesStatus =
        statusFilter === 'all' || invitation.status === statusFilter
      const matchesSearch =
        normalizedSearch.length === 0 ||
        invitation.email.includes(normalizedSearch) ||
        invitation.hotelName.toLowerCase().includes(normalizedSearch)
      return matchesStatus && matchesSearch
    })
  }, [invitations, search, statusFilter])

  const metrics = useMemo(() => {
    const rows = invitations ?? []
    return {
      pending: rows.filter((row) => row.status === 'pending').length,
      accepted: rows.filter((row) => row.status === 'accepted').length,
      attention: rows.filter(
        (row) => row.status === 'expired' || row.deliveryStatus === 'failed',
      ).length,
    }
  }, [invitations])
  const metricCards: Array<{
    key: 'pending' | 'accepted' | 'attention'
    value: number
    icon: typeof Clock3
    color: string
    label: TranslationKey
  }> = [
    {
      key: 'pending',
      value: metrics.pending,
      icon: Clock3,
      color: 'text-amber-300',
      label: 'admin.invitations.metric.pending',
    },
    {
      key: 'accepted',
      value: metrics.accepted,
      icon: CheckCircle2,
      color: 'text-emerald-300',
      label: 'admin.invitations.metric.accepted',
    },
    {
      key: 'attention',
      value: metrics.attention,
      icon: MailWarning,
      color: 'text-orange-300',
      label: 'admin.invitations.metric.attention',
    },
  ]
  const tableColumns: Array<TranslationKey> = [
    'admin.invitations.table.recipient',
    'admin.invitations.table.assignment',
    'admin.invitations.table.status',
    'admin.invitations.table.activity',
    'admin.invitations.table.actions',
  ]

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!effectiveHotelId || !email.trim()) return

    setSubmitting(true)
    try {
      const result = await createInvitation({
        email: email.trim(),
        hotelId: effectiveHotelId as Id<'hotels'>,
        role: effectiveRole,
      })
      setEmail('')
      if (result.emailQueued) {
        toast.success(t('admin.invitations.created'))
      } else {
        toast.warning(t('admin.invitations.createdEmailFailed'))
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('admin.invitations.createFailed'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async (invitationId: Id<'hotelStaffInvitations'>) => {
    setBusyInvitationId(invitationId)
    try {
      const result = await resendInvitation({ invitationId })
      if (result.emailQueued) {
        toast.success(t('admin.invitations.resent'))
      } else {
        toast.warning(t('admin.invitations.resendEmailFailed'))
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('admin.invitations.resendFailed'),
      )
    } finally {
      setBusyInvitationId(null)
    }
  }

  const handleRevoke = async (invitationId: Id<'hotelStaffInvitations'>) => {
    const confirmed = await confirm({
      title: t('admin.invitations.revoke'),
      description: t('admin.invitations.confirmRevoke'),
      confirmText: t('admin.invitations.revoke'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
    })
    if (!confirmed) return

    setBusyInvitationId(invitationId)
    try {
      await revokeInvitation({ invitationId })
      toast.success(t('admin.invitations.revokedSuccess'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('admin.invitations.revokeFailed'),
      )
    } finally {
      setBusyInvitationId(null)
    }
  }

  if (!canManage) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="admin-empty-state border-red-500/20 p-10 text-center">
          <ShieldCheck className="mx-auto mb-4 size-12 text-red-400" />
          <h2 className="text-xl font-semibold text-red-400">
            {t('admin.accessDenied')}
          </h2>
          <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('admin.invitations.accessDenied')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className={`relative overflow-hidden rounded-3xl border px-6 py-8 shadow-2xl sm:px-8 ${
        isDark
          ? 'border-violet-500/20 bg-slate-950 shadow-violet-950/20'
          : 'border-violet-200/60 bg-gradient-to-br from-white via-violet-50/60 to-slate-50 shadow-slate-200/40'
      }`}>
        <div className={`absolute -right-16 -top-20 size-64 rounded-full blur-3xl ${isDark ? 'bg-violet-500/15' : 'bg-violet-300/20'}`} />
        <div className={`absolute bottom-0 right-24 size-32 rounded-full blur-2xl ${isDark ? 'bg-indigo-400/10' : 'bg-indigo-300/15'}`} />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${
              isDark
                ? 'border-violet-400/20 bg-violet-400/10 text-violet-300'
                : 'border-violet-300/40 bg-violet-100/60 text-violet-600'
            }`}>
              <MailPlus className="size-3.5" />
              {t('admin.invitations.eyebrow')}
            </div>
            <h1
              className={`max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl ${isDark ? 'text-white' : 'text-slate-900'}`}
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {t('admin.invitations.title')}
            </h1>
            <p className={`mt-3 max-w-2xl text-sm leading-7 sm:text-base ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('admin.invitations.description')}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {metricCards.map(({ key, value, icon: Icon, color, label }) => (
              <div
                key={String(key)}
                className={`rounded-2xl border p-4 backdrop-blur-sm ${
                  isDark
                    ? 'border-white/10 bg-white/[0.045]'
                    : 'border-slate-200/80 bg-white/70'
                }`}
              >
                <Icon className={`mb-3 size-4 ${color}`} />
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
                <p className={`mt-1 text-[11px] uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t(label)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-7 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="admin-surface h-fit p-6">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2.5 text-violet-400">
              <Send className="size-5" />
            </div>
            <div>
              <h2
                className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}
              >
                {t('admin.invitations.newInvitation')}
              </h2>
              <p
                className={`mt-1 text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
              >
                {isRoomAdmin
                  ? t('admin.invitations.roomAdminHint')
                  : t('admin.invitations.hotelAdminHint')}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-5">
            <label className="block">
              <span
                className={`mb-2 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              >
                {t('admin.invitations.email')}
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('admin.invitations.emailPlaceholder')}
                className="admin-field w-full"
              />
            </label>

            <label className="block">
              <span
                className={`mb-2 block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              >
                {t('admin.invitations.hotel')}
              </span>
              {isRoomAdmin ? (
                <Select
                  value={selectedHotelId}
                  onValueChange={setSelectedHotelId}
                >
                  <SelectTrigger className="admin-select w-full">
                    <SelectValue placeholder={t('admin.invitations.chooseHotel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {hotels?.map((hotel) => (
                      <SelectItem key={hotel._id} value={hotel._id}>
                        {hotel.name} — {hotel.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="admin-surface-muted flex items-center gap-3 p-3.5">
                  <Building2 className="size-4 text-violet-400" />
                  <span
                    className={isDark ? 'text-slate-200' : 'text-slate-700'}
                  >
                    {assignedHotel?.name ?? t('admin.invitations.loading')}
                  </span>
                </div>
              )}
            </label>

            <fieldset>
              <legend
                className={`mb-2 text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              >
                {t('admin.invitations.role')}
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {(['hotel_admin', 'hotel_cashier'] as const).map(
                  (roleOption) => {
                    const disabled =
                      !isRoomAdmin && roleOption === 'hotel_admin'
                    const checked = effectiveRole === roleOption
                    return (
                      <label
                        key={roleOption}
                        className={`rounded-xl border p-3 transition-colors ${
                          checked
                            ? 'border-violet-500/40 bg-violet-500/10'
                            : isDark
                              ? 'border-slate-800 bg-slate-900/40'
                              : 'border-slate-200 bg-slate-50'
                        } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                      >
                        <input
                          type="radio"
                          name="invitation-role"
                          value={roleOption}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => setRole(roleOption)}
                          className="sr-only"
                        />
                        <span
                          className={`text-sm font-medium ${checked ? 'text-violet-400' : isDark ? 'text-slate-300' : 'text-slate-700'}`}
                        >
                          {t(
                            roleOption === 'hotel_admin'
                              ? 'admin.role.hotelAdmin'
                              : 'admin.role.hotelCashier',
                          )}
                        </span>
                      </label>
                    )
                  },
                )}
              </div>
            </fieldset>

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !effectiveHotelId || !email.trim()}
              className="w-full"
            >
              {submitting ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {submitting
                ? t('admin.invitations.sending')
                : t('admin.invitations.send')}
            </Button>
          </form>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className={`absolute left-4 top-1/2 -translate-y-1/2 size-4 pointer-events-none ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('admin.invitations.searchPlaceholder')}
                className="admin-field w-full !pl-11"
              />
            </div>
            <div className="w-full shrink-0 md:w-52">
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as typeof statusFilter)
                }
              >
                <SelectTrigger
                  className="admin-select w-full"
                  aria-label={t('admin.invitations.statusFilter')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.invitations.status.all')}</SelectItem>
                  <SelectItem value="pending">
                    {t('admin.invitations.status.pending')}
                  </SelectItem>
                  <SelectItem value="expired">
                    {t('admin.invitations.status.expired')}
                  </SelectItem>
                  <SelectItem value="accepted">
                    {t('admin.invitations.status.accepted')}
                  </SelectItem>
                  <SelectItem value="revoked">
                    {t('admin.invitations.status.revoked')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="admin-table-shell overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr
                    className={`border-b ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`}
                  >
                    {tableColumns.map((column) => (
                      <th
                        key={column}
                        className={`px-5 py-4 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {t(column)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invitations === undefined ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        {t('admin.invitations.loading')}
                      </td>
                    </tr>
                  ) : filteredInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-14 text-center">
                        <MailPlus className="mx-auto mb-3 size-9 text-slate-500" />
                        <p
                          className={
                            isDark ? 'text-slate-400' : 'text-slate-600'
                          }
                        >
                          {t('admin.invitations.empty')}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredInvitations.map((invitation) => {
                      const statusMeta = STATUS_META[invitation.status]
                      const StatusIcon = statusMeta.icon
                      const isBusy = busyInvitationId === invitation._id
                      return (
                        <tr key={invitation._id} className="admin-table-row">
                          <td className="px-5 py-4">
                            <p
                              className={`max-w-[220px] truncate text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                              title={invitation.email}
                            >
                              {invitation.email}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {t('admin.invitations.by', {
                                email: invitation.invitedByEmail,
                              })}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p
                              className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                            >
                              {invitation.hotelName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {t(
                                invitation.role === 'hotel_admin'
                                  ? 'admin.role.hotelAdmin'
                                  : 'admin.role.hotelCashier',
                              )}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}
                            >
                              <StatusIcon className="size-3.5" />
                              {t(statusMeta.label)}
                            </span>
                            {invitation.deliveryStatus === 'failed' &&
                            invitation.status === 'pending' ? (
                              <p className="mt-1.5 text-xs text-red-400">
                                {t('admin.invitations.deliveryFailed')}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500">
                            <p>
                              {t('admin.invitations.sentOn', {
                                date: new Date(
                                  invitation.lastSentAt ?? invitation.createdAt,
                                ).toLocaleDateString(dateLocale),
                              })}
                            </p>
                            <p className="mt-1">
                              {t('admin.invitations.expiresOn', {
                                date: new Date(
                                  invitation.expiresAt,
                                ).toLocaleDateString(dateLocale),
                              })}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {invitation.status === 'pending' ||
                              invitation.status === 'expired' ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleResend(invitation._id)
                                  }
                                >
                                  <RefreshCw
                                    className={`size-3.5 ${isBusy ? 'animate-spin' : ''}`}
                                  />
                                  {t('admin.invitations.resend')}
                                </Button>
                              ) : null}
                              {invitation.status === 'pending' ? (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleRevoke(invitation._id)
                                  }
                                >
                                  <Ban className="size-3.5" />
                                  {t('admin.invitations.revoke')}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
