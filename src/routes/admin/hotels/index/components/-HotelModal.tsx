// Modal form for creating or updating hotel records in admin hotels page.
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
import { getHotelCategoryLabel } from '../../../../../lib/hotelCategories'

interface HotelModalProps {
  hotelId: Id<'hotels'> | null
  onClose: () => void
}

type HotelCategory =
  | 'Boutique'
  | 'Budget'
  | 'Luxury'
  | 'Resort and Spa'
  | 'Extended-Stay'
  | 'Suite'

const categories: Array<HotelCategory> = [
  'Boutique',
  'Budget',
  'Luxury',
  'Resort and Spa',
  'Extended-Stay',
  'Suite',
]

export function HotelModal({ hotelId, onClose }: HotelModalProps) {
  // Unified create/edit modal that manages hotel form state and image uploads.
  const { user } = useUser()
  const { t } = useI18n()
  const hotel = useQuery(api.hotels.get, hotelId ? { hotelId } : 'skip')
  const createHotel = useMutation(api.hotels.create)
  const updateHotel = useMutation(api.hotels.update)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const trackUpload = useMutation(api.files.trackUpload)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    latitude: '',
    longitude: '',
    externalId: '',
    description: '',
    category: '' as HotelCategory | '',
    tags: '',
    parkingIncluded: false,
    rating: '',
    stateProvince: '',
    postalCode: '',
    lastRenovationDate: '',
    metadata: '',
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
    // Prefill form when editing; reset state when creating a new hotel.
    if (hotelId && hotel) {
      setFormData({
        name: hotel.name,
        address: hotel.address,
        city: hotel.city,
        country: hotel.country,
        latitude: hotel.location?.lat?.toString() ?? '',
        longitude: hotel.location?.lng?.toString() ?? '',
        externalId: hotel.externalId ?? '',
        description: hotel.description ?? '',
        category: hotel.category ?? '',
        tags: hotel.tags?.join(', ') ?? '',
        parkingIncluded: hotel.parkingIncluded ?? false,
        rating: hotel.rating?.toString() ?? '',
        stateProvince: hotel.stateProvince ?? '',
        postalCode: hotel.postalCode ?? '',
        lastRenovationDate: hotel.lastRenovationDate ?? '',
        metadata: hotel.metadata ? JSON.stringify(hotel.metadata, null, 2) : '',
      })
      setSelectedImageFile(null)
      setImagePreviewUrl(hotel.imageUrl ?? '')
      setImageStorageId(hotel.imageStorageId ?? null)
      setImageChanged(false)
      setClearImage(false)
      return
    }

    if (!hotelId) {
      setFormData({
        name: '',
        address: '',
        city: '',
        country: '',
        latitude: '',
        longitude: '',
        externalId: '',
        description: '',
        category: '',
        tags: '',
        parkingIncluded: false,
        rating: '',
        stateProvince: '',
        postalCode: '',
        lastRenovationDate: '',
        metadata: '',
      })
      setSelectedImageFile(null)
      setImagePreviewUrl('')
      setImageStorageId(null)
      setImageChanged(false)
      setClearImage(false)
    }
  }, [hotelId, hotel])

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

      const lat = formData.latitude.trim()
      const lng = formData.longitude.trim()
      if ((lat && !lng) || (!lat && lng)) {
        setError(t('admin.hotels.modal.error.latLngRequired'))
        return
      }

      let location: { lat: number; lng: number } | undefined
      if (lat && lng) {
        const parsedLat = Number(lat)
        const parsedLng = Number(lng)
        if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
          setError(t('admin.hotels.modal.error.latLngInvalid'))
          return
        }
        location = { lat: parsedLat, lng: parsedLng }
      }

      let metadata: Record<string, unknown> | undefined
      if (formData.metadata.trim()) {
        try {
          metadata = JSON.parse(formData.metadata)
        } catch {
          setError(t('admin.hotels.modal.error.metadataJson'))
          return
        }
      }

      const rating = formData.rating.trim()
        ? Number(formData.rating.trim())
        : undefined
      if (rating !== undefined && Number.isNaN(rating)) {
        setError(t('admin.hotels.modal.error.ratingInvalid'))
        return
      }

      const payload = {
        clerkUserId: user.id,
        name: formData.name,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        location,
        externalId: formData.externalId.trim() || undefined,
        description: formData.description.trim() || undefined,
        category: formData.category || undefined,
        tags: formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        parkingIncluded: formData.parkingIncluded,
        rating,
        stateProvince: formData.stateProvince.trim() || undefined,
        postalCode: formData.postalCode.trim() || undefined,
        lastRenovationDate: formData.lastRenovationDate.trim() || undefined,
        metadata,
      }

      if (hotelId) {
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
          ...payload,
          ...imagePayload,
        })
      } else {
        await createHotel({
          ...payload,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col my-4">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">
            {hotelId
              ? t('admin.hotels.modal.editTitle')
              : t('admin.hotels.modal.addTitle')}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {hotelId
              ? t('admin.hotels.modal.editDescription')
              : t('admin.hotels.modal.addDescription')}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
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
              placeholder={t('admin.hotels.modal.hotelNamePlaceholder')}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
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
              placeholder={t('admin.hotels.modal.addressPlaceholder')}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
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
                placeholder={t('admin.hotels.modal.cityPlaceholder')}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
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
                placeholder={t('admin.hotels.modal.countryPlaceholder')}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.hotels.modal.latitude')}
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData({ ...formData, latitude: e.target.value })
                }
                placeholder={t('admin.hotels.modal.latitudePlaceholder')}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.hotels.modal.longitude')}
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData({ ...formData, longitude: e.target.value })
                }
                placeholder={t('admin.hotels.modal.longitudePlaceholder')}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('admin.hotels.modal.description')}
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder={t('admin.hotels.modal.descriptionPlaceholder')}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('admin.hotels.modal.hotelImageOptional')}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelection}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded-lg file:bg-blue-500/20 file:text-blue-300 file:cursor-pointer"
            />
            <p className="text-xs text-slate-500 mt-2">
              {t('common.maxSize10mb')}
            </p>
            {imagePreviewUrl && (
              <div className="mt-3">
                <img
                  src={imagePreviewUrl}
                  alt={t('admin.hotels.modal.imagePreviewAlt')}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.hotels.modal.externalId')}
              </label>
              <input
                type="text"
                value={formData.externalId}
                onChange={(e) =>
                  setFormData({ ...formData, externalId: e.target.value })
                }
                placeholder={t('admin.hotels.modal.externalIdPlaceholder')}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.hotels.modal.category')}
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value as HotelCategory | '',
                  })
                }
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              >
                <option value="">
                  {t('admin.hotels.modal.selectCategory')}
                </option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {getHotelCategoryLabel(category, t)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.hotels.modal.stateProvince')}
              </label>
              <input
                type="text"
                value={formData.stateProvince}
                onChange={(e) =>
                  setFormData({ ...formData, stateProvince: e.target.value })
                }
                placeholder={t('admin.hotels.modal.stateProvincePlaceholder')}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.hotels.modal.postalCode')}
              </label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) =>
                  setFormData({ ...formData, postalCode: e.target.value })
                }
                placeholder={t('admin.hotels.modal.postalCodePlaceholder')}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.hotels.modal.rating')}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={formData.rating}
                onChange={(e) =>
                  setFormData({ ...formData, rating: e.target.value })
                }
                placeholder={t('admin.hotels.modal.ratingPlaceholder')}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.hotels.modal.lastRenovationDate')}
              </label>
              <input
                type="date"
                value={formData.lastRenovationDate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lastRenovationDate: e.target.value,
                  })
                }
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('admin.hotels.modal.tags')}
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) =>
                setFormData({ ...formData, tags: e.target.value })
              }
              placeholder={t('admin.hotels.modal.tagsPlaceholder')}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('admin.hotels.modal.metadata')}
            </label>
            <textarea
              rows={3}
              value={formData.metadata}
              onChange={(e) =>
                setFormData({ ...formData, metadata: e.target.value })
              }
              placeholder={t('admin.hotels.modal.metadataPlaceholder')}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="parkingIncluded"
              type="checkbox"
              checked={formData.parkingIncluded}
              onChange={(e) =>
                setFormData({ ...formData, parkingIncluded: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/40"
            />
            <label htmlFor="parkingIncluded" className="text-sm text-slate-300">
              {t('admin.hotels.modal.parkingIncluded')}
            </label>
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
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || uploadingImage
                ? uploadingImage
                  ? t('common.uploadingImage')
                  : t('common.saving')
                : hotelId
                  ? t('admin.hotels.modal.updateHotel')
                  : t('admin.hotels.modal.createHotel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
