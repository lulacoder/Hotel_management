// Modal form for creating and editing room records under a specific hotel.
import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { useEffect, useState } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import { Id } from '../../../../../../convex/_generated/dataModel'
import {
  uploadImageToConvex,
  validateImageFile,
} from '../../../../../lib/imageUpload'
import { useI18n } from '../../../../../lib/i18n'

interface RoomModalProps {
  hotelId: Id<'hotels'>
  roomId: Id<'rooms'> | null
  onClose: () => void
}

export function RoomModal({ hotelId, roomId, onClose }: RoomModalProps) {
  // Handles room create/edit flow with pricing, amenities, and image state.
  const { user } = useUser()
  const { t } = useI18n()
  const room = useQuery(api.rooms.get, roomId ? { roomId } : 'skip')
  const createRoom = useMutation(api.rooms.create)
  const updateRoom = useMutation(api.rooms.update)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const trackUpload = useMutation(api.files.trackUpload)

  const [formData, setFormData] = useState({
    roomNumber: '',
    type: 'budget' as 'budget' | 'standard' | 'suite' | 'deluxe',
    basePrice: '',
    maxOccupancy: '',
    amenities: '',
  })
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState('')
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [imageStorageId, setImageStorageId] = useState<Id<'_storage'> | null>(
    null,
  )
  const [imageChanged, setImageChanged] = useState(false)
  const [clearImage, setClearImage] = useState(false)

  useEffect(() => {
    // Sync form with selected room when editing; clear when creating.
    if (roomId && room) {
      setFormData({
        roomNumber: room.roomNumber,
        type: room.type,
        basePrice: (room.basePrice / 100).toString(),
        maxOccupancy: room.maxOccupancy.toString(),
        amenities: room.amenities?.join(', ') || '',
      })
      setSelectedImageFile(null)
      setImagePreviewUrl(room.imageUrl ?? '')
      setImageStorageId(room.imageStorageId ?? null)
      setImageChanged(false)
      setClearImage(false)
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
      setSelectedImageFile(null)
      setImagePreviewUrl('')
      setImageStorageId(null)
      setImageChanged(false)
      setClearImage(false)
    }
  }, [roomId, room])

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const validationError = validateImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setSelectedImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setImageChanged(true)
    setClearImage(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      let nextImageStorageId = imageStorageId
      if (selectedImageFile) {
        setUploadingImage(true)
        nextImageStorageId = await uploadImageToConvex({
          file: selectedImageFile,
          clerkUserId: user.id,
          generateUploadUrl,
          trackUpload,
        })
      }

      const basePriceNumber = Number(formData.basePrice)
      if (!Number.isFinite(basePriceNumber)) {
        setError(t('admin.hotels.roomModal.error.basePriceInvalid'))
        setLoading(false)
        return
      }

      const occupancy = Number.parseInt(formData.maxOccupancy, 10)
      if (!Number.isFinite(occupancy)) {
        setError(t('admin.hotels.roomModal.error.maxOccupancyInvalid'))
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
        const imagePayload: {
          imageStorageId?: Id<'_storage'>
          clearImage?: boolean
        } = {}

        if (imageChanged) {
          if (clearImage) {
            imagePayload.clearImage = true
          } else if (nextImageStorageId) {
            imagePayload.imageStorageId = nextImageStorageId
          }
        }

        await updateRoom({
          clerkUserId: user.id,
          roomId,
          roomNumber: formData.roomNumber,
          type: formData.type,
          basePrice: priceInCents,
          maxOccupancy: occupancy,
          amenities: amenitiesArray,
          ...imagePayload,
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
          imageStorageId: nextImageStorageId ?? undefined,
        })
      }
      onClose()
    } catch (err: any) {
      setError(err.message || t('admin.hotels.modal.error.generic'))
    } finally {
      setUploadingImage(false)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">
            {roomId
              ? t('admin.hotels.roomModal.editTitle')
              : t('admin.hotels.roomModal.addTitle')}
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
                {t('admin.hotels.roomModal.roomNumber')}
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
                {t('admin.hotels.roomModal.roomType')}
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
                <option value="budget">{t('hotel.budgetRoom')}</option>
                <option value="standard">{t('hotel.standardRoom')}</option>
                <option value="suite">{t('hotel.suiteRoom')}</option>
                <option value="deluxe">{t('hotel.deluxeRoom')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.hotels.roomModal.pricePerNight')}
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
                {t('admin.hotels.roomModal.maxOccupancy')}
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
              {t('admin.hotels.roomModal.roomImageOptional')}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelection}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded-lg file:bg-amber-500/20 file:text-amber-300 file:cursor-pointer"
            />
            <p className="text-xs text-slate-500 mt-2">
              {t('common.maxSize10mb')}
            </p>
            {imagePreviewUrl && (
              <div className="mt-3">
                <img
                  src={imagePreviewUrl}
                  alt="Room preview"
                  className="w-full h-32 object-cover rounded-xl border border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImageFile(null)
                    setImagePreviewUrl('')
                    setImageStorageId(null)
                    setImageChanged(true)
                    setClearImage(true)
                  }}
                  className="mt-2 text-xs text-red-400 hover:text-red-300"
                >
                  {t('common.removeImage')}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('admin.hotels.roomModal.amenities')}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50"
            >
              {loading || uploadingImage
                ? uploadingImage
                  ? t('common.uploadingImage')
                  : t('common.saving')
                : roomId
                  ? t('admin.hotels.roomModal.updateRoom')
                  : t('admin.hotels.roomModal.createRoom')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
