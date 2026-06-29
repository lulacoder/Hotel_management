import { useMemo, useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { useUser } from '@clerk/clerk-react'

import { api } from '../../../../../../convex/_generated/api'
import { useI18n } from '../../../../../lib/i18n/provider'
import { getHotelCategoryLabel } from '../../../../../lib/hotelCategories'
import { useTheme } from '../../../../../lib/theme'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { useMutation, useQuery } from '@/integrations/convex/hooks'
import { ImageField } from '@/components/form/ImageField'
import { TextAreaField, TextField } from '@/components/form/TextField'
import { getFirstErrorMessage } from '@/lib/forms'
import { useImageUpload } from '@/hooks/useImageUpload'

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
  const imageUpload = useImageUpload({
    initialStorageId: hotel?.imageStorageId ?? null,
    initialUrl: hotel?.imageUrl ?? '',
  })

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

      try {
        const nextImageStorageId = await imageUpload.commit({
          generateUploadUrl,
          trackUpload,
        })

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
          const imagePayload =
            imageUpload.buildUpdatePayload(nextImageStorageId)

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
      }
    },
  })

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const labelClass = `mb-2 block text-sm font-medium ${
    isDark ? 'text-slate-300' : 'text-slate-700'
  }`

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

  function submitLabel(): string {
    if (imageUpload.uploading) {
      return t('common.uploadingImage')
    }

    if (isSubmitting) {
      return t('common.saving')
    }

    return hotelId
      ? t('admin.hotels.modal.updateHotel')
      : t('admin.hotels.modal.createHotel')
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
            {(field) => (
              <TextField
                field={field}
                label={t('admin.hotels.modal.hotelName')}
                labelClassName={labelClass}
                aria-label={t('admin.hotels.modal.hotelName')}
                placeholder={t('admin.hotels.modal.hotelNamePlaceholder')}
              />
            )}
          </form.Field>

          <form.Field name="address">
            {(field) => (
              <TextField
                field={field}
                label={t('admin.hotels.modal.address')}
                labelClassName={labelClass}
                aria-label={t('admin.hotels.modal.address')}
                placeholder={t('admin.hotels.modal.addressPlaceholder')}
              />
            )}
          </form.Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="city">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.modal.city')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.modal.city')}
                  placeholder={t('admin.hotels.modal.cityPlaceholder')}
                />
              )}
            </form.Field>

            <form.Field name="country">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.modal.country')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.modal.country')}
                  placeholder={t('admin.hotels.modal.countryPlaceholder')}
                />
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="latitude">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.modal.latitude')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.modal.latitude')}
                  type="number"
                  step="any"
                  placeholder={t('admin.hotels.modal.latitudePlaceholder')}
                />
              )}
            </form.Field>

            <form.Field name="longitude">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.modal.longitude')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.modal.longitude')}
                  type="number"
                  step="any"
                  placeholder={t('admin.hotels.modal.longitudePlaceholder')}
                />
              )}
            </form.Field>
          </div>

          <form.Field name="description">
            {(field) => (
              <TextAreaField
                field={field}
                label={t('admin.hotels.modal.description')}
                labelClassName={labelClass}
                aria-label={t('admin.hotels.modal.description')}
                rows={4}
                placeholder={t('admin.hotels.modal.descriptionPlaceholder')}
              />
            )}
          </form.Field>

          <ImageField
            inputAriaLabel={t('admin.hotels.modal.hotelImageOptional')}
            isDark={isDark}
            label={t('admin.hotels.modal.hotelImageOptional')}
            maxSizeLabel={t('common.maxSize10mb')}
            onRemove={() => {
              imageUpload.remove()
              setSubmitError('')
            }}
            onSelect={(file) => {
              setSubmitError('')
              return imageUpload.selectFile(file)
            }}
            onValidationError={setSubmitError}
            previewAlt={t('admin.hotels.modal.imagePreviewAlt')}
            previewClassName={`h-44 w-full rounded-xl border object-cover ${
              isDark ? 'border-slate-700' : 'border-slate-200'
            }`}
            previewUrl={imageUpload.previewUrl}
            removeLabel={t('common.removeImage')}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="externalId">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.modal.externalId')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.modal.externalId')}
                  placeholder={t('admin.hotels.modal.externalIdPlaceholder')}
                />
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
                <TextField
                  field={field}
                  label={t('admin.hotels.modal.stateProvince')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.modal.stateProvince')}
                  placeholder={t('admin.hotels.modal.stateProvincePlaceholder')}
                />
              )}
            </form.Field>

            <form.Field name="postalCode">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.modal.postalCode')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.modal.postalCode')}
                  placeholder={t('admin.hotels.modal.postalCodePlaceholder')}
                />
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="rating">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.modal.rating')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.modal.rating')}
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  placeholder={t('admin.hotels.modal.ratingPlaceholder')}
                />
              )}
            </form.Field>

            <form.Field name="lastRenovationDate">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.modal.lastRenovationDate')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.modal.lastRenovationDate')}
                  type="date"
                />
              )}
            </form.Field>
          </div>

          <form.Field name="tags">
            {(field) => (
              <TextField
                field={field}
                label={t('admin.hotels.modal.tags')}
                labelClassName={labelClass}
                aria-label={t('admin.hotels.modal.tags')}
                placeholder={t('admin.hotels.modal.tagsPlaceholder')}
              />
            )}
          </form.Field>

          <form.Field name="metadata">
            {(field) => (
              <TextAreaField
                field={field}
                label={t('admin.hotels.modal.metadata')}
                labelClassName={labelClass}
                aria-label={t('admin.hotels.modal.metadata')}
                rows={5}
                placeholder={t('admin.hotels.modal.metadataPlaceholder')}
              />
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
                    disabled={isSubmitting || imageUpload.uploading || blocked}
                    className="admin-button-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitLabel()}
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
