// Modal for assigning user roles and hotel access from the admin users page.
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useI18n } from '../../../../lib/i18n'

interface AssignModalProps {
  userId: Id<'users'>
  onClose: () => void
}

export function AssignModal({ userId, onClose }: AssignModalProps) {
  // Collect hotel + role and submit assignment for the selected user.
  const { user } = useUser()
  const { t } = useI18n()
  const [selectedHotelId, setSelectedHotelId] = useState<Id<'hotels'> | ''>('')
  const [role, setRole] = useState<'hotel_admin' | 'hotel_cashier'>(
    'hotel_admin',
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hotels = useQuery(api.hotels.list, {})
  const assignUser = useMutation(api.hotelStaff.assign)

  const handleSubmit = async (event: React.FormEvent) => {
    // Validate form and execute assignment mutation.
    event.preventDefault()
    if (!user?.id) return

    if (!selectedHotelId) {
      setError(t('admin.users.assignModal.selectHotelRequired'))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await assignUser({
        clerkUserId: user.id,
        targetUserId: userId,
        hotelId: selectedHotelId,
        role,
      })
      onClose()
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t('admin.users.assignModal.assignFailed'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              {t('admin.users.assignModal.title')}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {t('admin.users.assignModal.description')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl p-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('admin.users.assignModal.selectHotel')}
            </label>
            <select
              value={selectedHotelId}
              onChange={(e) =>
                setSelectedHotelId(e.target.value as Id<'hotels'>)
              }
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50"
              required
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
          </div>

          <div>
            <p className="block text-sm font-medium text-slate-300 mb-3">
              {t('admin.users.assignModal.role')}
            </p>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="staff-role"
                  value="hotel_admin"
                  checked={role === 'hotel_admin'}
                  onChange={() => setRole('hotel_admin')}
                  className="mt-1"
                />
                <div>
                  <p className="text-slate-200 font-medium">
                    {t('admin.users.assignModal.hotelAdmin')}
                  </p>
                  <p className="text-sm text-slate-500">
                    {t('admin.users.assignModal.hotelAdminDescription')}
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="staff-role"
                  value="hotel_cashier"
                  checked={role === 'hotel_cashier'}
                  onChange={() => setRole('hotel_cashier')}
                  className="mt-1"
                />
                <div>
                  <p className="text-slate-200 font-medium">
                    {t('admin.users.assignModal.cashier')}
                  </p>
                  <p className="text-sm text-slate-500">
                    {t('admin.users.assignModal.cashierDescription')}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!selectedHotelId || isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? t('admin.users.assignModal.assigning')
                : t('admin.users.assignModal.assignUser')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
