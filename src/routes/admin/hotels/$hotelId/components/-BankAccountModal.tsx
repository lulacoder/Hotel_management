import { useMemo, useState } from 'react'
import { useMutation } from 'convex/react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'

import { api } from '../../../../../../convex/_generated/api'
import { useI18n } from '../../../../../lib/i18n/provider'
import { useTheme } from '../../../../../lib/theme'
import type { Id } from '../../../../../../convex/_generated/dataModel'

interface BankAccountModalProps {
  hotelId: Id<'hotels'>
  account: {
    _id: Id<'hotelBankAccounts'>
    bankName: string
    accountNumber: string
  } | null
  onClose: () => void
}

function getFirstErrorMessage(
  errors: Array<unknown> | undefined,
): string | null {
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

export function BankAccountModal({
  hotelId,
  account,
  onClose,
}: BankAccountModalProps) {
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const createAccount = useMutation(api.hotelBankAccounts.create)
  const updateAccount = useMutation(api.hotelBankAccounts.update)
  const [submitError, setSubmitError] = useState('')

  const schema = useMemo(
    () =>
      z.object({
        bankName: z
          .string()
          .trim()
          .min(1, t('admin.hotels.payment.bankNameRequired')),
        accountNumber: z
          .string()
          .trim()
          .min(1, t('admin.hotels.payment.accountNumberRequired')),
      }),
    [t],
  )

  const form = useForm({
    defaultValues: {
      bankName: account?.bankName ?? '',
      accountNumber: account?.accountNumber ?? '',
    },
    validators: {
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError('')

      try {
        if (account) {
          await updateAccount({
            accountId: account._id,
            bankName: value.bankName.trim(),
            accountNumber: value.accountNumber.trim(),
          })
        } else {
          await createAccount({
            hotelId,
            bankName: value.bankName.trim(),
            accountNumber: value.accountNumber.trim(),
          })
        }

        onClose()
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : t('admin.hotels.payment.saveFailed'),
        )
      }
    },
  })

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const bankNameError = getFirstErrorMessage(
    form.getFieldMeta('bankName')?.errors,
  )
  const accountNumberError = getFirstErrorMessage(
    form.getFieldMeta('accountNumber')?.errors,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="admin-modal-panel w-full max-w-lg">
        <div className="admin-modal-header">
          <h2
            className={`text-xl font-semibold ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {t('admin.hotels.payment.modalTitle')}
          </h2>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
          className="admin-modal-body space-y-4"
        >
          {submitError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {submitError}
            </div>
          ) : null}

          <form.Field name="bankName">
            {(field) => (
              <div>
                <label
                  className={`mb-2 block text-sm font-medium ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {t('admin.hotels.payment.bankName')}
                </label>
                <input
                  aria-label={t('admin.hotels.payment.bankName')}
                  type="text"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.hotels.payment.bankNamePlaceholder')}
                  className={`admin-field ${
                    bankNameError
                      ? 'border-red-500/60 focus:border-red-500/80'
                      : ''
                  }`}
                />
                {bankNameError ? (
                  <p className="mt-2 text-xs text-red-400">{bankNameError}</p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field name="accountNumber">
            {(field) => (
              <div>
                <label
                  className={`mb-2 block text-sm font-medium ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {t('admin.hotels.payment.accountNumber')}
                </label>
                <input
                  aria-label={t('admin.hotels.payment.accountNumber')}
                  type="text"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.hotels.payment.accountPlaceholder')}
                  className={`admin-field ${
                    accountNumberError
                      ? 'border-red-500/60 focus:border-red-500/80'
                      : ''
                  }`}
                />
                {accountNumberError ? (
                  <p className="mt-2 text-xs text-red-400">
                    {accountNumberError}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          <div className="admin-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="admin-button-secondary flex-1"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="admin-button-primary flex-1 disabled:opacity-50"
            >
              {isSubmitting
                ? t('common.saving')
                : t('admin.hotels.payment.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
