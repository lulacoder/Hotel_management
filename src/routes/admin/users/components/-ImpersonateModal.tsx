import { useMemo, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  Loader2,
  ShieldAlert,
  UserRoundCog,
  X,
} from 'lucide-react'
import { z } from 'zod'

import { api } from '../../../../../convex/_generated/api'
import { AdminSpinner } from '../../../../components/AdminSpinner'
import { Button } from '../../../../components/ui/button'
import { getFirstErrorMessage } from '../../../../lib/forms'
import { setClientImpersonation } from '../../../../lib/authRouting'
import { useI18n } from '../../../../lib/i18n/provider'
import {
  DEFAULT_ADMIN_DASHBOARD_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../../../../lib/navigationSearch'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useMutation } from '@/integrations/convex/hooks'

interface ImpersonateModalProps {
  user: {
    _id: Id<'users'>
    email: string
    role: 'customer' | 'room_admin'
    assignment?: {
      role: 'hotel_admin' | 'hotel_cashier'
      hotelName: string
      hotelCity: string
    }
  }
  onClose: () => void
}

// Collects the required audit reason before starting an impersonation session
export function ImpersonateModal({ user, onClose }: ImpersonateModalProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const startImpersonation = useMutation(api.impersonation.startImpersonation)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const reasonSchema = useMemo(
    () =>
      z
        .string()
        .trim()
        .min(3, t('admin.users.impersonateModal.reasonRequired')),
    [t],
  )

  const form = useForm({
    defaultValues: {
      reason: '',
    },
    validators: {
      onSubmit: z.object({ reason: reasonSchema }),
    },
    // Starts impersonation, then opens the target workspace without reloading the app
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      setIsTransitioning(true)

      try {
        const result = await startImpersonation({
          targetUserId: user._id,
          reason: value.reason.trim(),
        })

        setClientImpersonation({
          isImpersonating: true,
          targetUserId: user._id,
          targetRole: user.role,
          expiresAt: result.expiresAt,
        })

        if (user.assignment) {
          await navigate({
            to: '/admin',
            search: DEFAULT_ADMIN_DASHBOARD_SEARCH,
            replace: true,
          })
          return
        }

        await navigate({
          to: '/select-location',
          search: DEFAULT_SELECT_LOCATION_SEARCH,
          replace: true,
        })
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : t('admin.users.impersonateModal.startFailed'),
        )
        setIsTransitioning(false)
      }
    },
  })

  const targetRole = user.assignment
    ? user.assignment.role === 'hotel_admin'
      ? t('admin.role.hotelAdmin')
      : t('admin.role.hotelCashier')
    : t('admin.role.customer')

  if (isTransitioning) {
    return (
      <AdminSpinner
        overlay
        label={t('admin.users.impersonateModal.switching', {
          email: user.email,
        })}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="impersonate-modal-title"
        className="admin-modal-panel w-full max-w-lg"
      >
        <div className="admin-modal-header">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-500">
              <UserRoundCog className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="impersonate-modal-title"
                className="text-xl font-semibold text-slate-900 dark:text-slate-100"
              >
                {t('admin.users.impersonateModal.title')}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('admin.users.impersonateModal.description')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={t('common.close')}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <div className="admin-modal-body space-y-5">
            {submitError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-600 dark:text-red-300"
              >
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{submitError}</span>
              </div>
            ) : null}

            <div className="admin-surface-muted rounded-xl p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('admin.users.impersonateModal.targetUser')}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {user.email}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {targetRole}
                {user.assignment ? `, ${user.assignment.hotelName}` : ''}
              </p>
            </div>

            <form.Field name="reason">
              {(field) => {
                const reasonError = getFirstErrorMessage(
                  field.state.meta.errors,
                )

                return (
                  <div>
                    <label
                      htmlFor="impersonation-reason"
                      className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      {t('admin.users.impersonateModal.reason')}
                    </label>
                    <textarea
                      id="impersonation-reason"
                      rows={4}
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      placeholder={t(
                        'admin.users.impersonateModal.reasonPlaceholder',
                      )}
                      aria-invalid={Boolean(reasonError)}
                      aria-describedby={
                        reasonError ? 'impersonation-reason-error' : undefined
                      }
                      className="admin-textarea resize-none aria-invalid:border-red-500/60"
                    />
                    {reasonError ? (
                      <p
                        id="impersonation-reason-error"
                        className="mt-2 text-xs font-medium text-red-600 dark:text-red-400"
                      >
                        {reasonError}
                      </p>
                    ) : null}
                  </div>
                )
              }}
            </form.Field>

            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <ShieldAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <p>{t('admin.users.impersonateModal.duration')}</p>
            </div>
          </div>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="admin-modal-footer">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-amber-500 font-semibold text-slate-950 hover:bg-amber-600"
                >
                  {isSubmitting ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <UserRoundCog className="size-4" aria-hidden="true" />
                  )}
                  {isSubmitting
                    ? t('admin.users.impersonateModal.starting')
                    : t('admin.users.impersonateModal.start')}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  )
}
