import { useNavigate } from '@tanstack/react-router'
import { LogOut, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useMutation, useQuery } from '@/integrations/convex/hooks'
import {
  clearClientImpersonation,
  setClientImpersonation,
} from '@/lib/authRouting'
import { useI18n } from '@/lib/i18n/provider'

import { api } from '../../convex/_generated/api'
import { AdminSpinner } from './AdminSpinner'

// Keeps the active impersonation state visible and lets the administrator exit it
export function ImpersonationBanner() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const activeSession = useQuery(api.impersonation.getActiveSession, {})
  const stopImpersonation = useMutation(api.impersonation.stopImpersonation)
  const [isStopping, setIsStopping] = useState(false)

  const isSessionLoading = activeSession === undefined
  const isImpersonating = activeSession?.isImpersonating ?? false
  const targetUserId = activeSession?.targetUserId
  const targetRole = activeSession?.targetRole
  const expiresAt = activeSession?.expiresAt

  // Keep the route bootstrap cache aligned without repeating writes for equal sessions
  useEffect(() => {
    if (isSessionLoading) return

    if (!isImpersonating || !targetUserId || !targetRole || !expiresAt) {
      clearClientImpersonation()
      return
    }

    setClientImpersonation({
      isImpersonating: true,
      targetUserId,
      targetRole,
      expiresAt,
    })
  }, [expiresAt, isImpersonating, isSessionLoading, targetRole, targetUserId])

  if (isStopping) {
    return <AdminSpinner overlay label={t('admin.impersonation.restoring')} />
  }

  if (!activeSession || !isImpersonating) {
    return null
  }

  // Ends impersonation and restores the administrator workspace without a page reload
  const handleExit = async () => {
    setIsStopping(true)
    try {
      await stopImpersonation({})
      clearClientImpersonation()
      await navigate({ to: '/admin/users', replace: true })
      setIsStopping(false)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to end impersonation session.'
      toast.error(message)
      setIsStopping(false)
    }
  }

  return (
    <aside
      role="status"
      aria-label={t('admin.impersonation.activeSession')}
      className="sticky top-0 z-[9999] w-full border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-950 shadow-sm dark:border-amber-400/25 dark:bg-amber-400 dark:text-slate-950"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          <p className="truncate text-xs sm:text-sm">
            {t('admin.impersonation.actingAs')}{' '}
            <strong className="font-semibold">
              {activeSession.targetEmail}
            </strong>
          </p>
        </div>

        <button
          type="button"
          onClick={handleExit}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-50 shadow-sm transition-colors hover:bg-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-950/40 dark:bg-slate-950 dark:text-amber-100 dark:hover:bg-slate-900"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          <span>{t('admin.impersonation.exit')}</span>
        </button>
      </div>
    </aside>
  )
}
