import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { useEffect, useState } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import { Id } from '../../../../../../convex/_generated/dataModel'

interface RoomModalProps {
  hotelId: Id<'hotels'>
  roomId: Id<'rooms'> | null
  onClose: () => void
}

export function RoomModal({ hotelId, roomId, onClose }: RoomModalProps) {
  const { user } = useUser()
  const room = useQuery(api.rooms.get, roomId ? { roomId } : 'skip')
  const createRoom = useMutation(api.rooms.create)
  const updateRoom = useMutation(api.rooms.update)

  const [formData, setFormData] = useState({
    roomNumber: '',
    type: 'budget' as 'budget' | 'standard' | 'suite' | 'deluxe',
    basePrice: '',
    maxOccupancy: '',
    amenities: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (roomId && room) {
      setFormData({
        roomNumber: room.roomNumber,
        type: room.type,
        basePrice: (room.basePrice / 100).toString(),
        maxOccupancy: room.maxOccupancy.toString(),
        amenities: room.amenities?.join(', ') || '',
      })
      return
    }

    if (!roomId) {
      setFormData({
        roomNumber: '',
        type: 'budget',
        basePrice: '',
        maxOccupancy: '',
        amenities: '',
      })
    }
  }, [roomId, room])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      const basePriceNumber = Number(formData.basePrice)
      if (!Number.isFinite(basePriceNumber)) {
        setError('Please enter a valid base price.')
        setLoading(false)
        return
      }

      const occupancy = Number.parseInt(formData.maxOccupancy, 10)
      if (!Number.isFinite(occupancy)) {
        setError('Please enter a valid max occupancy.')
        setLoading(false)
        return
      }

      const priceInCents = Math.round(basePriceNumber * 100)
      const amenitiesArray = formData.amenities
        ? formData.amenities
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean)
        : undefined

      if (roomId) {
        await updateRoom({
          clerkUserId: user.id,
          roomId,
          roomNumber: formData.roomNumber,
          type: formData.type,
          basePrice: priceInCents,
          maxOccupancy: occupancy,
          amenities: amenitiesArray,
        })
      } else {
        await createRoom({
          clerkUserId: user.id,
          hotelId,
          roomNumber: formData.roomNumber,
          type: formData.type,
          basePrice: priceInCents,
          maxOccupancy: occupancy,
          amenities: amenitiesArray,
        })
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">
            {roomId ? 'Edit Room' : 'Add New Room'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Room Number
              </label>
              <input
                type="text"
                required
                value={formData.roomNumber}
                onChange={(e) =>
                  setFormData({ ...formData, roomNumber: e.target.value })
                }
                placeholder="101"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Room Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as
                      | 'budget'
                      | 'standard'
                      | 'suite'
                      | 'deluxe',
                  })
                }
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
              >
                <option value="budget">Budget</option>
                <option value="standard">Standard</option>
                <option value="suite">Suite</option>
                <option value="deluxe">Deluxe</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Price per Night ($)
              </label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={formData.basePrice}
                onChange={(e) =>
                  setFormData({ ...formData, basePrice: e.target.value })
                }
                placeholder="150.00"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Max Occupancy
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.maxOccupancy}
                onChange={(e) =>
                  setFormData({ ...formData, maxOccupancy: e.target.value })
                }
                placeholder="2"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Amenities (comma-separated)
            </label>
            <input
              type="text"
              value={formData.amenities}
              onChange={(e) =>
                setFormData({ ...formData, amenities: e.target.value })
              }
              placeholder="WiFi, TV, Mini Bar, Air Conditioning"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : roomId ? 'Update Room' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
