// Modal form for creating and editing hotel bank accounts.
import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { useI18n } from '../../../../../lib/i18n'

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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">
            {t('admin.hotels.payment.modalTitle')}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('admin.hotels.payment.bankName')}
            </label>
            <input
              type="text"
              required
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder={t('admin.hotels.payment.bankNamePlaceholder')}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('admin.hotels.payment.accountNumber')}
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={t('admin.hotels.payment.accountPlaceholder')}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? t('common.saving') : t('admin.hotels.payment.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
