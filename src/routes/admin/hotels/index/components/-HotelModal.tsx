import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { useUser } from '@clerk/clerk-react'

import { api } from '../../../../../../convex/_generated/api'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import {
  uploadImageToConvex,
  validateImageFile,
} from '../../../../../lib/imageUpload'
import { useI18n } from '../../../../../lib/i18n'
import { getHotelCategoryLabel } from '../../../../../lib/hotelCategories'
import { useTheme } from '../../../../../lib/theme'

interface HotelModalProps {
  hotelId: Id<'hotels'> | null
  onClose: () => void
}

const categoryOptions = [
  'Boutique',
  'Budget',
  'Luxury',
  'Resort and Spa',
  'Extended-Stay',
  'Suite',
] as const

type HotelCategory = (typeof categoryOptions)[number]

interface HotelFormValues {
  name: string
  address: string
  city: string
  country: string
  latitude: string
  longitude: string
  externalId: string
  description: string
  category: HotelCategory | ''
  tags: string
  parkingIncluded: boolean
  rating: string
  stateProvince: string
  postalCode: string
  lastRenovationDate: string
  metadata: string
}

const categories: HotelCategory[] = [...categoryOptions]

function buildHotelDefaultValues(
  hotel:
    | {
        name: string
        address: string
        city: string
        country: string
        location?: { lat: number; lng: number }
        externalId?: string
        description?: string
        category?: HotelCategory
        tags?: string[]
        parkingIncluded?: boolean
        rating?: number
        stateProvince?: string
        postalCode?: string
        lastRenovationDate?: string
        metadata?: Record<string, unknown>
      }
    | null
    | undefined,
): HotelFormValues {
  return {
    name: hotel?.name ?? '',
    address: hotel?.address ?? '',
    city: hotel?.city ?? '',
    country: hotel?.country ?? '',
    latitude: hotel?.location?.lat?.toString() ?? '',
    longitude: hotel?.location?.lng?.toString() ?? '',
    externalId: hotel?.externalId ?? '',
    description: hotel?.description ?? '',
    category: hotel?.category ?? '',
    tags: hotel?.tags?.join(', ') ?? '',
    parkingIncluded: hotel?.parkingIncluded ?? false,
    rating: hotel?.rating?.toString() ?? '',
    stateProvince: hotel?.stateProvince ?? '',
    postalCode: hotel?.postalCode ?? '',
    lastRenovationDate: hotel?.lastRenovationDate ?? '',
    metadata: hotel?.metadata ? JSON.stringify(hotel.metadata, null, 2) : '',
  }
}

function getFirstErrorMessage(errors: unknown[] | undefined): string | null {
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

export function HotelModal({ hotelId, onClose }: HotelModalProps) {
  const { user } = useUser()
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const hotel = useQuery(api.hotels.get, hotelId ? { hotelId } : 'skip')
  const createHotel = useMutation(api.hotels.create)
  const updateHotel = useMutation(api.hotels.update)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const trackUpload = useMutation(api.files.trackUpload)

  const [submitError, setSubmitError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [imageStorageId, setImageStorageId] = useState<Id<'_storage'> | null>(
    null,
  )
  const [imageChanged, setImageChanged] = useState(false)
  const [clearImage, setClearImage] = useState(false)

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, 'Hotel name is required.'),
          address: z.string().trim().min(1, 'Address is required.'),
          city: z.string().trim().min(1, 'City is required.'),
          country: z.string().trim().min(1, 'Country is required.'),
          latitude: z.string(),
          longitude: z.string(),
          externalId: z.string(),
          description: z.string(),
          category: z.union([
            z.literal(''),
            z.enum(categoryOptions),
          ]) as z.ZodType<HotelCategory | ''>,
          tags: z.string(),
          parkingIncluded: z.boolean(),
          rating: z.string(),
          stateProvince: z.string(),
          postalCode: z.string(),
          lastRenovationDate: z.string(),
          metadata: z.string(),
        })
        .superRefine((value, ctx) => {
          const latitude = value.latitude.trim()
          const longitude = value.longitude.trim()

          if ((latitude && !longitude) || (!latitude && longitude)) {
            ctx.addIssue({
              code: 'custom',
              path: ['latitude'],
              message: t('admin.hotels.modal.error.latLngRequired'),
            })
            ctx.addIssue({
              code: 'custom',
              path: ['longitude'],
              message: t('admin.hotels.modal.error.latLngRequired'),
            })
          }

          if (latitude && Number.isNaN(Number(latitude))) {
            ctx.addIssue({
              code: 'custom',
              path: ['latitude'],
              message: t('admin.hotels.modal.error.latLngInvalid'),
            })
          }

          if (longitude && Number.isNaN(Number(longitude))) {
            ctx.addIssue({
              code: 'custom',
              path: ['longitude'],
              message: t('admin.hotels.modal.error.latLngInvalid'),
            })
          }

          const rating = value.rating.trim()
          if (rating && Number.isNaN(Number(rating))) {
            ctx.addIssue({
              code: 'custom',
              path: ['rating'],
              message: t('admin.hotels.modal.error.ratingInvalid'),
            })
          }

          const metadata = value.metadata.trim()
          if (metadata) {
            try {
              const parsed = JSON.parse(metadata)
              if (
                !parsed ||
                typeof parsed !== 'object' ||
                Array.isArray(parsed)
              ) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['metadata'],
                  message: t('admin.hotels.modal.error.metadataJson'),
                })
              }
            } catch {
              ctx.addIssue({
                code: 'custom',
                path: ['metadata'],
                message: t('admin.hotels.modal.error.metadataJson'),
              })
            }
          }
        }),
    [t],
  )

  const form = useForm({
    defaultValues: buildHotelDefaultValues(hotel),
    validators: {
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      if (!user?.id) {
        return
      }

      setSubmitError('')
      setUploadingImage(false)

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

        const latitude = value.latitude.trim()
        const longitude = value.longitude.trim()
        const location =
          latitude && longitude
            ? {
                lat: Number(latitude),
                lng: Number(longitude),
              }
            : undefined

        const metadata = value.metadata.trim()
          ? (JSON.parse(value.metadata.trim()) as Record<string, unknown>)
          : undefined

        const rating = value.rating.trim()
          ? Number(value.rating.trim())
          : undefined

        const payload = {
          name: value.name.trim(),
          address: value.address.trim(),
          city: value.city.trim(),
          country: value.country.trim(),
          location,
          externalId: value.externalId.trim() || undefined,
          description: value.description.trim() || undefined,
          category: value.category || undefined,
          tags: value.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          parkingIncluded: value.parkingIncluded,
          rating,
          stateProvince: value.stateProvince.trim() || undefined,
          postalCode: value.postalCode.trim() || undefined,
          lastRenovationDate: value.lastRenovationDate.trim() || undefined,
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
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : t('admin.hotels.modal.error.generic'),
        )
      } finally {
        setUploadingImage(false)
      }
    },
  })

  useEffect(() => {
    form.reset(buildHotelDefaultValues(hotel))
    setSelectedImageFile(null)
    setImagePreviewUrl(hotel?.imageUrl ?? '')
    setImageStorageId(hotel?.imageStorageId ?? null)
    setImageChanged(false)
    setClearImage(false)
    setSubmitError('')
  }, [form, hotel, hotelId])

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const labelClass = `mb-2 block text-sm font-medium ${
    isDark ? 'text-slate-300' : 'text-slate-700'
  }`

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const validationError = validateImageFile(file)
    if (validationError) {
      setSubmitError(validationError)
      return
    }

    setSubmitError('')
    setSelectedImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setImageChanged(true)
    setClearImage(false)
  }

  const nameError = getFirstErrorMessage(form.getFieldMeta('name')?.errors)
  const addressError = getFirstErrorMessage(
    form.getFieldMeta('address')?.errors,
  )
  const cityError = getFirstErrorMessage(form.getFieldMeta('city')?.errors)
  const countryError = getFirstErrorMessage(
    form.getFieldMeta('country')?.errors,
  )
  const latitudeError = getFirstErrorMessage(
    form.getFieldMeta('latitude')?.errors,
  )
  const longitudeError = getFirstErrorMessage(
    form.getFieldMeta('longitude')?.errors,
  )
  const ratingError = getFirstErrorMessage(form.getFieldMeta('rating')?.errors)
  const metadataError = getFirstErrorMessage(
    form.getFieldMeta('metadata')?.errors,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="admin-modal-panel my-4 w-full max-w-3xl max-h-[90vh]">
        <div className="admin-modal-header">
          <div>
            <h2
              className={`text-xl font-semibold ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {hotelId
                ? t('admin.hotels.modal.editTitle')
                : t('admin.hotels.modal.addTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {hotelId
                ? t('admin.hotels.modal.editDescription')
                : t('admin.hotels.modal.addDescription')}
            </p>
          </div>
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

          <form.Field name="name">
            {(field) => (
              <div>
                <label className={labelClass}>
                  {t('admin.hotels.modal.hotelName')}
                </label>
                <input
                  type="text"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.hotels.modal.hotelNamePlaceholder')}
                  className={`admin-field ${
                    nameError ? 'border-red-500/60 focus:border-red-500/80' : ''
                  }`}
                />
                {nameError ? (
                  <p className="mt-2 text-xs text-red-400">{nameError}</p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field name="address">
            {(field) => (
              <div>
                <label className={labelClass}>
                  {t('admin.hotels.modal.address')}
                </label>
                <input
                  type="text"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.hotels.modal.addressPlaceholder')}
                  className={`admin-field ${
                    addressError
                      ? 'border-red-500/60 focus:border-red-500/80'
                      : ''
                  }`}
                />
                {addressError ? (
                  <p className="mt-2 text-xs text-red-400">{addressError}</p>
                ) : null}
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="city">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.city')}
                  </label>
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.modal.cityPlaceholder')}
                    className={`admin-field ${
                      cityError
                        ? 'border-red-500/60 focus:border-red-500/80'
                        : ''
                    }`}
                  />
                  {cityError ? (
                    <p className="mt-2 text-xs text-red-400">{cityError}</p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <form.Field name="country">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.country')}
                  </label>
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.modal.countryPlaceholder')}
                    className={`admin-field ${
                      countryError
                        ? 'border-red-500/60 focus:border-red-500/80'
                        : ''
                    }`}
                  />
                  {countryError ? (
                    <p className="mt-2 text-xs text-red-400">{countryError}</p>
                  ) : null}
                </div>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="latitude">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.latitude')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.modal.latitudePlaceholder')}
                    className={`admin-field ${
                      latitudeError
                        ? 'border-red-500/60 focus:border-red-500/80'
                        : ''
                    }`}
                  />
                  {latitudeError ? (
                    <p className="mt-2 text-xs text-red-400">{latitudeError}</p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <form.Field name="longitude">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.longitude')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.modal.longitudePlaceholder')}
                    className={`admin-field ${
                      longitudeError
                        ? 'border-red-500/60 focus:border-red-500/80'
                        : ''
                    }`}
                  />
                  {longitudeError ? (
                    <p className="mt-2 text-xs text-red-400">
                      {longitudeError}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="description">
            {(field) => (
              <div>
                <label className={labelClass}>
                  {t('admin.hotels.modal.description')}
                </label>
                <textarea
                  rows={4}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.hotels.modal.descriptionPlaceholder')}
                  className="admin-textarea"
                />
              </div>
            )}
          </form.Field>

          <div>
            <label className={labelClass}>
              {t('admin.hotels.modal.hotelImageOptional')}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelection}
              className={`admin-field py-2.5 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-3 file:py-1.5 file:text-violet-300 ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            />
            <p
              className={`mt-2 text-xs ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {t('common.maxSize10mb')}
            </p>
            {imagePreviewUrl ? (
              <div className="mt-3">
                <img
                  src={imagePreviewUrl}
                  alt={t('admin.hotels.modal.imagePreviewAlt')}
                  className={`h-44 w-full rounded-xl border object-cover ${
                    isDark ? 'border-slate-700' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImageFile(null)
                    setImagePreviewUrl('')
                    setImageStorageId(null)
                    setImageChanged(true)
                    setClearImage(true)
                    setSubmitError('')
                  }}
                  className="mt-3 cursor-pointer text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                >
                  {t('common.removeImage')}
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="externalId">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.externalId')}
                  </label>
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.modal.externalIdPlaceholder')}
                    className="admin-field"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="category">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.category')}
                  </label>
                  <select
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(
                        event.target.value as HotelCategory | '',
                      )
                    }
                    onBlur={field.handleBlur}
                    className="admin-select"
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
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="stateProvince">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.stateProvince')}
                  </label>
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t(
                      'admin.hotels.modal.stateProvincePlaceholder',
                    )}
                    className="admin-field"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="postalCode">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.postalCode')}
                  </label>
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.modal.postalCodePlaceholder')}
                    className="admin-field"
                  />
                </div>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="rating">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.rating')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.modal.ratingPlaceholder')}
                    className={`admin-field ${
                      ratingError
                        ? 'border-red-500/60 focus:border-red-500/80'
                        : ''
                    }`}
                  />
                  {ratingError ? (
                    <p className="mt-2 text-xs text-red-400">{ratingError}</p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <form.Field name="lastRenovationDate">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.lastRenovationDate')}
                  </label>
                  <input
                    type="date"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    className="admin-field"
                  />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="tags">
            {(field) => (
              <div>
                <label className={labelClass}>
                  {t('admin.hotels.modal.tags')}
                </label>
                <input
                  type="text"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.hotels.modal.tagsPlaceholder')}
                  className="admin-field"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="metadata">
            {(field) => (
              <div>
                <label className={labelClass}>
                  {t('admin.hotels.modal.metadata')}
                </label>
                <textarea
                  rows={5}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.hotels.modal.metadataPlaceholder')}
                  className={`admin-textarea ${
                    metadataError
                      ? 'border-red-500/60 focus:border-red-500/80'
                      : ''
                  }`}
                />
                {metadataError ? (
                  <p className="mt-2 text-xs text-red-400">{metadataError}</p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field name="parkingIncluded">
            {(field) => (
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  id="parkingIncluded"
                  type="checkbox"
                  checked={field.state.value}
                  onChange={(event) => field.handleChange(event.target.checked)}
                  onBlur={field.handleBlur}
                  className={`h-4 w-4 rounded focus:ring-violet-500/40 ${
                    isDark
                      ? 'border-slate-600 bg-slate-800 text-violet-500'
                      : 'border-slate-300 bg-white text-violet-500'
                  }`}
                />
                <span
                  className={`text-sm ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {t('admin.hotels.modal.parkingIncluded')}
                </span>
              </label>
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
              disabled={isSubmitting || uploadingImage}
              className="admin-button-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting || uploadingImage
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
