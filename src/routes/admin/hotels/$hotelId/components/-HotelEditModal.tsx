import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { useEffect, useState } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import { Id } from '../../../../../../convex/_generated/dataModel'
import { uploadImageToConvex, validateImageFile } from '../../../../../lib/imageUpload'
import { useI18n } from '../../../../../lib/i18n'

interface HotelEditModalProps {
  hotelId: Id<'hotels'>
  onClose: () => void
}

export function HotelEditModal({ hotelId, onClose }: HotelEditModalProps) {
  const { user } = useUser()
  const { t } = useI18n()
  const hotel = useQuery(api.hotels.get, { hotelId })
  const updateHotel = useMutation(api.hotels.update)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const trackUpload = useMutation(api.files.trackUpload)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
  })
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState('')
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [imageStorageId, setImageStorageId] = useState<Id<'_storage'> | null>(null)
  const [imageChanged, setImageChanged] = useState(false)
  const [clearImage, setClearImage] = useState(false)

  useEffect(() => {
    if (hotel) {
      setFormData({
        name: hotel.name,
        address: hotel.address,
        city: hotel.city,
        country: hotel.country,
      })
      setSelectedImageFile(null)
      setImagePreviewUrl(hotel.imageUrl ?? '')
      setImageStorageId(hotel.imageStorageId ?? null)
      setImageChanged(false)
      setClearImage(false)
    }
  }, [hotel])

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

      await updateHotel({
        clerkUserId: user.id,
        hotelId,
        ...formData,
        ...imagePayload,
      })
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
            {t('admin.hotels.modal.editTitle')}
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
              {t('admin.hotels.modal.hotelName')}
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('admin.hotels.modal.address')}
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                 {t('admin.hotels.modal.city')}
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                 {t('admin.hotels.modal.country')}
              </label>
              <input
                type="text"
                required
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
               {t('admin.hotels.modal.hotelImageOptional')}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelection}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded-lg file:bg-amber-500/20 file:text-amber-300 file:cursor-pointer"
            />
             <p className="text-xs text-slate-500 mt-2">{t('common.maxSize10mb')}</p>
            {imagePreviewUrl && (
              <div className="mt-3">
                <img
                  src={imagePreviewUrl}
                  alt="Hotel preview"
                  className="w-full h-36 object-cover rounded-xl border border-slate-700"
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
                : t('admin.hotels.modal.updateHotel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
