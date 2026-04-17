import { useMutation, useQuery } from '@/integrations/convex/hooks'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useI18n } from '../../../../lib/i18n'
import { useTheme } from '../../../../lib/theme'

interface AssignModalProps {
  userId: Id<'users'>
  onClose: () => void
}

function getFirstErrorMessage(errors: unknown[] | undefined): string | null {
  if (!errors) {
    return null
  }

  for (const error of errors) {
    if (!error) {
      continue
    }

    if (typeof error === 'string') {
      return error
    }

    if (typeof error === 'object' && 'message' in error) {
      const message = error.message
      if (typeof message === 'string') {
        return message
      }
    }
  }

  return null
}

export function AssignModal({ userId, onClose }: AssignModalProps) {
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const hotels = useQuery(api.hotels.list, {})
  const assignUser = useMutation(api.hotelStaff.assign)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const schema = z.object({
    selectedHotelId: z
      .string()
      .min(1, t('admin.users.assignModal.selectHotelRequired')),
    role: z.enum(['hotel_admin', 'hotel_cashier']),
  })

  const form = useForm({
    defaultValues: {
      selectedHotelId: '',
      role: 'hotel_admin' as 'hotel_admin' | 'hotel_cashier',
    },
    validators: {
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)

      try {
        await assignUser({
          targetUserId: userId,
          hotelId: value.selectedHotelId as Id<'hotels'>,
          role: value.role,
        })
        onClose()
      } catch (submissionError) {
        setSubmitError(
          submissionError instanceof Error
            ? submissionError.message
            : t('admin.users.assignModal.assignFailed'),
        )
      }
    },
  })

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const selectedHotelId = useStore(
    form.store,
    (state) => state.values.selectedHotelId,
  )
  const role = useStore(form.store, (state) => state.values.role)
  const hotelError = getFirstErrorMessage(
    form.getFieldMeta('selectedHotelId')?.errors,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="admin-modal-panel w-full max-w-xl">
        <div className="admin-modal-header">
          <div>
            <h2
              className={`text-xl font-semibold ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {t('admin.users.assignModal.title')}
            </h2>
            <p
              className={`mt-1 text-sm ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {t('admin.users.assignModal.description')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-2 transition-colors ${
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
            }`}
            aria-label={t('common.close')}
          >
            <X
              className={`h-5 w-5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
          className="admin-modal-body space-y-6"
        >
          {submitError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {submitError}
            </div>
          ) : null}

          <form.Field name="selectedHotelId">
            {(field) => (
              <div>
                <label
                  className={`mb-2 block text-sm font-medium ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {t('admin.users.assignModal.selectHotel')}
                </label>
                <select
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  className={`admin-select ${
                    hotelError
                      ? 'border-red-500/60 focus:border-red-500/80'
                      : ''
                  }`}
                >
                  <option value="">
                    {t('admin.users.assignModal.chooseHotel')}
                  </option>
                  {hotels?.map((hotel) => (
                    <option key={hotel._id} value={hotel._id}>
                      {hotel.name} - {hotel.city}, {hotel.country}
                    </option>
                  ))}
                </select>
                {hotelError ? (
                  <p className="mt-2 text-xs text-red-400">{hotelError}</p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field name="role">
            {(field) => (
              <div>
                <p
                  className={`mb-3 block text-sm font-medium ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {t('admin.users.assignModal.role')}
                </p>
                <div className="space-y-3">
                  <label
                    className={`admin-surface-muted flex cursor-pointer items-start gap-3 p-3 transition-colors ${
                      field.state.value === 'hotel_admin'
                        ? isDark
                          ? 'border-violet-500/30 bg-violet-500/10'
                          : 'border-violet-300/70 bg-violet-50/80'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="staff-role"
                      value="hotel_admin"
                      checked={field.state.value === 'hotel_admin'}
                      onChange={() => field.handleChange('hotel_admin')}
                      onBlur={field.handleBlur}
                      className="mt-1"
                    />
                    <div>
                      <p
                        className={`font-medium ${
                          isDark ? 'text-slate-200' : 'text-slate-800'
                        }`}
                      >
                        {t('admin.users.assignModal.hotelAdmin')}
                      </p>
                      <p
                        className={`text-sm ${
                          isDark ? 'text-slate-500' : 'text-slate-500'
                        }`}
                      >
                        {t('admin.users.assignModal.hotelAdminDescription')}
                      </p>
                    </div>
                  </label>

                  <label
                    className={`admin-surface-muted flex cursor-pointer items-start gap-3 p-3 transition-colors ${
                      field.state.value === 'hotel_cashier'
                        ? isDark
                          ? 'border-violet-500/30 bg-violet-500/10'
                          : 'border-violet-300/70 bg-violet-50/80'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="staff-role"
                      value="hotel_cashier"
                      checked={field.state.value === 'hotel_cashier'}
                      onChange={() => field.handleChange('hotel_cashier')}
                      onBlur={field.handleBlur}
                      className="mt-1"
                    />
                    <div>
                      <p
                        className={`font-medium ${
                          isDark ? 'text-slate-200' : 'text-slate-800'
                        }`}
                      >
                        {t('admin.users.assignModal.cashier')}
                      </p>
                      <p
                        className={`text-sm ${
                          isDark ? 'text-slate-500' : 'text-slate-500'
                        }`}
                      >
                        {t('admin.users.assignModal.cashierDescription')}
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </form.Field>

          <div className="admin-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="admin-button-secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!selectedHotelId || isSubmitting}
              className="admin-button-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? t('admin.users.assignModal.assigning')
                : role === 'hotel_admin'
                  ? t('admin.users.assignModal.assignUser')
                  : t('admin.users.assignModal.assignUser')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

