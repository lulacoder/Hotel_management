// Modal form for creating and editing hotel bank accounts.
import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { useI18n } from '../../../../../lib/i18n'
import { useTheme } from '../../../../../lib/theme'

interface BankAccountModalProps {
  hotelId: Id<'hotels'>
  account: {
    _id: Id<'hotelBankAccounts'>
    bankName: string
    accountNumber: string
  } | null
  onClose: () => void
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

  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (account) {
      setBankName(account.bankName)
      setAccountNumber(account.accountNumber)
      return
    }

    setBankName('')
    setAccountNumber('')
  }, [account])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const trimmedBankName = bankName.trim()
    const trimmedAccountNumber = accountNumber.trim()

    if (!trimmedBankName) {
      setError(t('admin.hotels.payment.bankNameRequired'))
      return
    }

    if (!trimmedAccountNumber) {
      setError(t('admin.hotels.payment.accountNumberRequired'))
      return
    }

    setLoading(true)
    setError('')

    try {
      if (account) {
        await updateAccount({
          accountId: account._id,
          bankName: trimmedBankName,
          accountNumber: trimmedAccountNumber,
        })
      } else {
        await createAccount({
          hotelId,
          bankName: trimmedBankName,
          accountNumber: trimmedAccountNumber,
        })
      }

      onClose()
    } catch (err: any) {
      setError(err?.message || t('admin.hotels.payment.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="admin-modal-panel w-full max-w-lg">
        <div className="admin-modal-header">
          <h2
            className={`text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          >
            {t('admin.hotels.payment.modalTitle')}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="admin-modal-body space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
            >
              {t('admin.hotels.payment.bankName')}
            </label>
            <input
              type="text"
              required
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder={t('admin.hotels.payment.bankNamePlaceholder')}
              className="admin-field"
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
            >
              {t('admin.hotels.payment.accountNumber')}
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={t('admin.hotels.payment.accountPlaceholder')}
              className="admin-field"
            />
          </div>

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
              disabled={loading}
              className="admin-button-primary flex-1 disabled:opacity-50"
            >
              {loading ? t('common.saving') : t('admin.hotels.payment.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
