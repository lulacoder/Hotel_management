import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'

interface AssignModalProps {
  userId: Id<'users'>
  onClose: () => void
}

export function AssignModal({ userId, onClose }: AssignModalProps) {
  const { user } = useUser()
  const [selectedHotelId, setSelectedHotelId] = useState<Id<'hotels'> | ''>('')
  const [role, setRole] = useState<'hotel_admin' | 'hotel_cashier'>('hotel_admin')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hotels = useQuery(api.hotels.list, {})
  const assignUser = useMutation(api.hotelStaff.assign)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.id) return

    if (!selectedHotelId) {
      setError('Please select a hotel before assigning the user.')
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
          : 'Failed to assign user. Please try again.',
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
            <h2 className="text-xl font-semibold text-slate-100">Assign User to Hotel</h2>
            <p className="text-sm text-slate-400 mt-1">
              Select a hotel and staff role for this user.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close"
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
            <label className="block text-sm font-medium text-slate-300 mb-2">Select Hotel</label>
            <select
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value as Id<'hotels'>)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
              required
            >
              <option value="">Choose a hotel...</option>
              {hotels?.map((hotel) => (
                <option key={hotel._id} value={hotel._id}>
                  {hotel.name} - {hotel.city}, {hotel.country}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="block text-sm font-medium text-slate-300 mb-3">Role</p>
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
                  <p className="text-slate-200 font-medium">Hotel Administrator</p>
                  <p className="text-sm text-slate-500">
                    Can manage rooms, bookings, and hotel settings.
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
                  <p className="text-slate-200 font-medium">Cashier</p>
                  <p className="text-sm text-slate-500">
                    Can view bookings, check-in/out guests, and process refunds.
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedHotelId || isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Assigning...' : 'Assign User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
