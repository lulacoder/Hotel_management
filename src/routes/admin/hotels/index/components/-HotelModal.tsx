import { useMemo, useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { useUser } from '@clerk/clerk-react'

import { api } from '../../../../../../convex/_generated/api'
import {
  uploadImageToConvex,
  validateImageFile,
} from '../../../../../lib/imageUpload'
import { useI18n } from '../../../../../lib/i18n/provider'
import { getHotelCategoryLabel } from '../../../../../lib/hotelCategories'
import { useTheme } from '../../../../../lib/theme'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { useMutation, useQuery } from '@/integrations/convex/hooks'

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

const categories: Array<HotelCategory> = [...categoryOptions]

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
        tags?: Array<string>
        parkingIncluded?: boolean
        rating?: number
        stateProvince?: string
        postalCode?: string
        lastRenovationDate?: string
        metadata?: Record<string, unknown>
        imageUrl?: string
        imageStorageId?: Id<'_storage'> | null
      }
    | null
    | undefined,
): HotelFormValues {
  return {
    name: hotel?.name ?? '',
    address: hotel?.address ?? '',
    city: hotel?.city ?? '',
    country: hotel?.country ?? '',
    latitude: hotel?.location?.lat.toString() ?? '',
    longitude: hotel?.location?.lng.toString() ?? '',
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

function getFirstErrorMessage(errors: Array<unknown> | undefined): string | null {
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

type HotelModalHotel = Parameters<typeof buildHotelDefaultValues>[0]

export function HotelModal({ hotelId, onClose }: HotelModalProps) {
  const hotel = useQuery(api.hotels.get, hotelId ? { hotelId } : 'skip')

  if (hotelId && hotel === undefined) {
    return null
  }

  return (
    <HotelModalContent
      key={hotelId ?? 'new-hotel'}
      hotelId={hotelId}
      hotel={hotel}
      onClose={onClose}
    />
  )
}

function HotelModalContent({
  hotelId,
  hotel,
  onClose,
}: HotelModalProps & { hotel: HotelModalHotel }) {
  const { user } = useUser()
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const createHotel = useMutation(api.hotels.create)
  const updateHotel = useMutation(api.hotels.update)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const trackUpload = useMutation(api.files.trackUpload)

  const [submitError, setSubmitError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(hotel?.imageUrl ?? '')
  const [imageStorageId, setImageStorageId] = useState<Id<'_storage'> | null>(
    hotel?.imageStorageId ?? null,
  )
  const [imageChanged, setImageChanged] = useState(false)
  const [clearImage, setClearImage] = useState(false)

  const schema = useMemo(
    () =>
      z
        .object({
          name: z
            .string()
            .trim()
            .min(1, t('admin.hotels.modal.error.nameRequired')),
          address: z
            .string()
            .trim()
            .min(1, t('admin.hotels.modal.error.addressRequired')),
          city: z
            .string()
            .trim()
            .min(1, t('admin.hotels.modal.error.cityRequired')),
          country: z
            .string()
            .trim()
            .min(1, t('admin.hotels.modal.error.countryRequired')),
          latitude: z.string(),
          longitude: z.string(),
          externalId: z.string(),
          description: z.string(),
          category: z.enum(['', ...categoryOptions]),
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

          if (latitude) {
            const lat = Number(latitude)
            if (Number.isNaN(lat)) {
              ctx.addIssue({
                code: 'custom',
                path: ['latitude'],
                message: t('admin.hotels.modal.error.latLngInvalid'),
              })
            } else if (lat < -90 || lat > 90) {
              ctx.addIssue({
                code: 'custom',
                path: ['latitude'],
                message: t('admin.hotels.modal.error.latRange'),
              })
            }
          }

          if (longitude) {
            const lng = Number(longitude)
            if (Number.isNaN(lng)) {
              ctx.addIssue({
                code: 'custom',
                path: ['longitude'],
                message: t('admin.hotels.modal.error.latLngInvalid'),
              })
            } else if (lng < -180 || lng > 180) {
              ctx.addIssue({
                code: 'custom',
                path: ['longitude'],
                message: t('admin.hotels.modal.error.lngRange'),
              })
            }
          }

          const rating = value.rating.trim()
          if (rating) {
            const ratingNum = Number(rating)
            if (Number.isNaN(ratingNum)) {
              ctx.addIssue({
                code: 'custom',
                path: ['rating'],
                message: t('admin.hotels.modal.error.ratingInvalid'),
              })
            } else if (ratingNum < 0 || ratingNum > 5) {
              ctx.addIssue({
                code: 'custom',
                path: ['rating'],
                message: t('admin.hotels.modal.error.ratingRange'),
              })
            }
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
      onChange: schema,
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
          tags: value.tags.split(',').flatMap((tag) => {
            const trimmedTag = tag.trim()
            return trimmedTag ? [trimmedTag] : []
          }),
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

  const fieldLabels: Partial<Record<keyof HotelFormValues, string>> = {
    name: t('admin.hotels.modal.hotelName'),
    address: t('admin.hotels.modal.address'),
    city: t('admin.hotels.modal.city'),
    country: t('admin.hotels.modal.country'),
    latitude: t('admin.hotels.modal.latitude'),
    longitude: t('admin.hotels.modal.longitude'),
    rating: t('admin.hotels.modal.rating'),
    metadata: t('admin.hotels.modal.metadata'),
  }

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

          <form.Subscribe
            selector={(state) => ({
              submissionAttempts: state.submissionAttempts,
              fieldMeta: state.fieldMeta,
            })}
          >
            {({ submissionAttempts, fieldMeta }) => {
              if (submissionAttempts === 0) {
                return null
              }
              const issues = (
                Object.keys(fieldMeta) as Array<keyof HotelFormValues>
              ).flatMap((fieldName) => {
                const message = getFirstErrorMessage(
                  fieldMeta[fieldName]?.errors,
                )
                if (!message) {
                  return []
                }
                const label = fieldLabels[fieldName]
                return [
                  label
                    ? t('admin.hotels.modal.error.fieldLabel', {
                        field: label,
                        message,
                      })
                    : message,
                ]
              })
              if (issues.length === 0) {
                return null
              }
              return (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400"
                >
                  <p className="font-medium">
                    {t('admin.hotels.modal.error.summaryTitle')}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )
            }}
          </form.Subscribe>

          <form.Field name="name">
            {(field) => {
              const error = getFirstErrorMessage(field.state.meta.errors)
              return (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.hotelName')}
                  </label>
                  <input
                    aria-label={t('admin.hotels.modal.hotelName')}
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.modal.hotelNamePlaceholder')}
                    className={`admin-field ${
                      error ? 'border-red-500/60 focus:border-red-500/80' : ''
                    }`}
                  />
                  {error ? (
                    <p className="mt-2 text-xs text-red-400">{error}</p>
                  ) : null}
                </div>
              )
            }}
          </form.Field>

          <form.Field name="address">
            {(field) => {
              const error = getFirstErrorMessage(field.state.meta.errors)
              return (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.address')}
                  </label>
                  <input
                    aria-label={t('admin.hotels.modal.address')}
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.modal.addressPlaceholder')}
                    className={`admin-field ${
                      error ? 'border-red-500/60 focus:border-red-500/80' : ''
                    }`}
                  />
                  {error ? (
                    <p className="mt-2 text-xs text-red-400">{error}</p>
                  ) : null}
                </div>
              )
            }}
          </form.Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="city">
              {(field) => {
                const error = getFirstErrorMessage(field.state.meta.errors)
                return (
                  <div>
                    <label className={labelClass}>
                      {t('admin.hotels.modal.city')}
                    </label>
                    <input
                      aria-label={t('admin.hotels.modal.city')}
                      type="text"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      placeholder={t('admin.hotels.modal.cityPlaceholder')}
                      className={`admin-field ${
                        error ? 'border-red-500/60 focus:border-red-500/80' : ''
                      }`}
                    />
                    {error ? (
                      <p className="mt-2 text-xs text-red-400">{error}</p>
                    ) : null}
                  </div>
                )
              }}
            </form.Field>

            <form.Field name="country">
              {(field) => {
                const error = getFirstErrorMessage(field.state.meta.errors)
                return (
                  <div>
                    <label className={labelClass}>
                      {t('admin.hotels.modal.country')}
                    </label>
                    <input
                      aria-label={t('admin.hotels.modal.country')}
                      type="text"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      placeholder={t('admin.hotels.modal.countryPlaceholder')}
                      className={`admin-field ${
                        error ? 'border-red-500/60 focus:border-red-500/80' : ''
                      }`}
                    />
                    {error ? (
                      <p className="mt-2 text-xs text-red-400">{error}</p>
                    ) : null}
                  </div>
                )
              }}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="latitude">
              {(field) => {
                const error = getFirstErrorMessage(field.state.meta.errors)
                return (
                  <div>
                    <label className={labelClass}>
                      {t('admin.hotels.modal.latitude')}
                    </label>
                    <input
                      aria-label={t('admin.hotels.modal.latitude')}
                      type="number"
                      step="any"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      placeholder={t('admin.hotels.modal.latitudePlaceholder')}
                      className={`admin-field ${
                        error ? 'border-red-500/60 focus:border-red-500/80' : ''
                      }`}
                    />
                    {error ? (
                      <p className="mt-2 text-xs text-red-400">{error}</p>
                    ) : null}
                  </div>
                )
              }}
            </form.Field>

            <form.Field name="longitude">
              {(field) => {
                const error = getFirstErrorMessage(field.state.meta.errors)
                return (
                  <div>
                    <label className={labelClass}>
                      {t('admin.hotels.modal.longitude')}
                    </label>
                    <input
                      aria-label={t('admin.hotels.modal.longitude')}
                      type="number"
                      step="any"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      placeholder={t('admin.hotels.modal.longitudePlaceholder')}
                      className={`admin-field ${
                        error ? 'border-red-500/60 focus:border-red-500/80' : ''
                      }`}
                    />
                    {error ? (
                      <p className="mt-2 text-xs text-red-400">{error}</p>
                    ) : null}
                  </div>
                )
              }}
            </form.Field>
          </div>

          <form.Field name="description">
            {(field) => (
              <div>
                <label className={labelClass}>
                  {t('admin.hotels.modal.description')}
                </label>
                <textarea
                  aria-label={t('admin.hotels.modal.description')}
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
              aria-label={t('admin.hotels.modal.hotelImageOptional')}
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
                    aria-label={t('admin.hotels.modal.externalId')}
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
                    aria-label={t('admin.hotels.modal.stateProvince')}
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
                    aria-label={t('admin.hotels.modal.postalCode')}
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
              {(field) => {
                const error = getFirstErrorMessage(field.state.meta.errors)
                return (
                  <div>
                    <label className={labelClass}>
                      {t('admin.hotels.modal.rating')}
                    </label>
                    <input
                      aria-label={t('admin.hotels.modal.rating')}
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      placeholder={t('admin.hotels.modal.ratingPlaceholder')}
                      className={`admin-field ${
                        error ? 'border-red-500/60 focus:border-red-500/80' : ''
                      }`}
                    />
                    {error ? (
                      <p className="mt-2 text-xs text-red-400">{error}</p>
                    ) : null}
                  </div>
                )
              }}
            </form.Field>

            <form.Field name="lastRenovationDate">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.lastRenovationDate')}
                  </label>
                  <input
                    aria-label={t('admin.hotels.modal.lastRenovationDate')}
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
                  aria-label={t('admin.hotels.modal.tags')}
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
            {(field) => {
              const error = getFirstErrorMessage(field.state.meta.errors)
              return (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.modal.metadata')}
                  </label>
                  <textarea
                    aria-label={t('admin.hotels.modal.metadata')}
                    rows={5}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.modal.metadataPlaceholder')}
                    className={`admin-textarea ${
                      error ? 'border-red-500/60 focus:border-red-500/80' : ''
                    }`}
                  />
                  {error ? (
                    <p className="mt-2 text-xs text-red-400">{error}</p>
                  ) : null}
                </div>
              )
            }}
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
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                submissionAttempts: state.submissionAttempts,
              })}
            >
              {({ canSubmit, submissionAttempts }) => {
                const blocked = submissionAttempts > 0 && !canSubmit
                return (
                  <button
                    type="submit"
                    disabled={isSubmitting || uploadingImage || blocked}
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
                )
              }}
            </form.Subscribe>
          </div>
        </form>
      </div>
    </div>
  )
}
