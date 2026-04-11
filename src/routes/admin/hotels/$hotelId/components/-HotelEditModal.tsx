// Modal form for editing metadata and configuration of a selected hotel.
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
import { useTheme } from '../../../../../lib/theme'

interface HotelEditModalProps {
  hotelId: Id<'hotels'>
  onClose: () => void
}

export function HotelEditModal({ hotelId, onClose }: HotelEditModalProps) {
  // Focused edit modal for core hotel fields and optional image updates.
  const { user } = useUser()
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
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
  const [imageStorageId, setImageStorageId] = useState<Id<'_storage'> | null>(
    null,
  )
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
    // Validate image input and stage local preview before upload.
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
      <div className="admin-modal-panel w-full max-w-lg">
        <div className="admin-modal-header">
          <h2
            className={`text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          >
            {t('admin.hotels.modal.editTitle')}
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
              {t('admin.hotels.modal.hotelName')}
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="admin-field"
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
            >
              {t('admin.hotels.modal.address')}
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="admin-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              >
                {t('admin.hotels.modal.city')}
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                className="admin-field"
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              >
                {t('admin.hotels.modal.country')}
              </label>
              <input
                type="text"
                required
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                className="admin-field"
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
            >
              {t('admin.hotels.modal.hotelImageOptional')}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelection}
              className={`admin-field py-2.5 file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded-lg file:bg-violet-500/20 file:text-violet-300 file:cursor-pointer ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            />
            <p
              className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {t('common.maxSize10mb')}
            </p>
            {imagePreviewUrl && (
              <div className="mt-3">
                <img
                  src={imagePreviewUrl}
                  alt={t('admin.hotels.modal.imagePreviewAlt')}
                  className={`w-full h-36 object-cover rounded-xl border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
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
              disabled={loading || uploadingImage}
              className="admin-button-primary flex-1 disabled:opacity-50"
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
