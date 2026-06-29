import { useMemo, useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { useUser } from '@clerk/clerk-react'

import { api } from '../../../../../../convex/_generated/api'
import { useI18n } from '../../../../../lib/i18n/provider'
import { useTheme } from '../../../../../lib/theme'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { useMutation, useQuery } from '@/integrations/convex/hooks'
import { ImageField } from '@/components/form/ImageField'
import { TextAreaField, TextField } from '@/components/form/TextField'
import { getFirstErrorMessage } from '@/lib/forms'
import { useImageUpload } from '@/hooks/useImageUpload'

interface RoomModalProps {
  hotelId: Id<'hotels'>
  roomId: Id<'rooms'> | null
  onClose: () => void
}

type RoomType = 'budget' | 'standard' | 'suite' | 'deluxe'

interface RoomFormValues {
  roomNumber: string
  type: RoomType
  basePrice: string
  maxOccupancy: string
  amenities: string
  description: string
  bedOptions: string
  smokingAllowed: boolean
}

function buildRoomDefaultValues(
  room:
    | {
        roomNumber: string
        type: RoomType
        basePrice: number
        maxOccupancy: number
        amenities?: Array<string>
        description?: string
        bedOptions?: string
        smokingAllowed?: boolean
        imageUrl?: string
        imageStorageId?: Id<'_storage'> | null
      }
    | null
    | undefined,
): RoomFormValues {
  return {
    roomNumber: room?.roomNumber ?? '',
    type: room?.type ?? 'budget',
    basePrice: room ? (room.basePrice / 100).toString() : '',
    maxOccupancy: room?.maxOccupancy.toString() ?? '',
    amenities: room?.amenities?.join(', ') ?? '',
    description: room?.description ?? '',
    bedOptions: room?.bedOptions ?? '',
    smokingAllowed: room?.smokingAllowed ?? false,
  }
}

type RoomModalRoom = Parameters<typeof buildRoomDefaultValues>[0]

export function RoomModal({ hotelId, roomId, onClose }: RoomModalProps) {
  const room = useQuery(api.rooms.get, roomId ? { roomId } : 'skip')

  if (roomId && room === undefined) {
    return null
  }

  return (
    <RoomModalContent
      key={roomId ?? 'new-room'}
      hotelId={hotelId}
      roomId={roomId}
      room={room}
      onClose={onClose}
    />
  )
}

function RoomModalContent({
  hotelId,
  roomId,
  room,
  onClose,
}: RoomModalProps & { room: RoomModalRoom }) {
  const { user } = useUser()
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const createRoom = useMutation(api.rooms.create)
  const updateRoom = useMutation(api.rooms.update)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const trackUpload = useMutation(api.files.trackUpload)

  const [submitError, setSubmitError] = useState('')
  const imageUpload = useImageUpload({
    initialStorageId: room?.imageStorageId ?? null,
    initialUrl: room?.imageUrl ?? '',
  })

  const schema = useMemo(
    () =>
      z.object({
        roomNumber: z
          .string()
          .trim()
          .min(1, t('admin.hotels.roomModal.error.roomNumberRequired')),
        type: z.enum(['budget', 'standard', 'suite', 'deluxe']),
        basePrice: z
          .string()
          .trim()
          .min(1, t('admin.hotels.roomModal.error.basePriceInvalid'))
          .refine((value) => {
            const parsed = Number(value)
            return Number.isFinite(parsed) && parsed > 0
          }, t('admin.hotels.roomModal.error.basePriceInvalid')),
        maxOccupancy: z
          .string()
          .trim()
          .min(1, t('admin.hotels.roomModal.error.maxOccupancyInvalid'))
          .refine((value) => {
            const parsed = Number.parseInt(value, 10)
            return (
              Number.isInteger(parsed) &&
              parsed > 0 &&
              String(parsed) === value.trim()
            )
          }, t('admin.hotels.roomModal.error.maxOccupancyInvalid')),
        amenities: z.string(),
        description: z.string(),
        bedOptions: z.string(),
        smokingAllowed: z.boolean(),
      }),
    [t],
  )

  const form = useForm({
    defaultValues: buildRoomDefaultValues(room),
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

        const payload = {
          roomNumber: value.roomNumber.trim(),
          type: value.type,
          basePrice: Math.round(Number(value.basePrice.trim()) * 100),
          maxOccupancy: Number.parseInt(value.maxOccupancy.trim(), 10),
          amenities: value.amenities.split(',').flatMap((item) => {
            const trimmedItem = item.trim()
            return trimmedItem ? [trimmedItem] : []
          }),
          description: value.description.trim() || undefined,
          bedOptions: value.bedOptions.trim() || undefined,
          smokingAllowed: value.smokingAllowed,
        }

        if (roomId) {
          const imagePayload =
            imageUpload.buildUpdatePayload(nextImageStorageId)

          await updateRoom({
            roomId,
            ...payload,
            amenities: payload.amenities.length ? payload.amenities : undefined,
            ...imagePayload,
          })
        } else {
          await createRoom({
            hotelId,
            ...payload,
            amenities: payload.amenities.length ? payload.amenities : undefined,
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
  const fieldLabels: Partial<Record<keyof RoomFormValues, string>> = {
    roomNumber: t('admin.hotels.roomModal.roomNumber'),
    basePrice: t('admin.hotels.roomModal.pricePerNight'),
    maxOccupancy: t('admin.hotels.roomModal.maxOccupancy'),
  }
  const labelClass = `mb-2 block text-sm font-medium ${
    isDark ? 'text-slate-300' : 'text-slate-700'
  }`

  function submitLabel(): string {
    if (imageUpload.uploading) {
      return t('common.uploadingImage')
    }

    if (isSubmitting) {
      return t('common.saving')
    }

    return roomId
      ? t('admin.hotels.roomModal.updateRoom')
      : t('admin.hotels.roomModal.createRoom')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="admin-modal-panel w-full max-w-2xl">
        <div className="admin-modal-header">
          <h2
            className={`text-xl font-semibold ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {roomId
              ? t('admin.hotels.roomModal.editTitle')
              : t('admin.hotels.roomModal.addTitle')}
          </h2>
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
                Object.keys(fieldMeta) as Array<keyof RoomFormValues>
              ).flatMap((fieldName) => {
                const message = getFirstErrorMessage(
                  fieldMeta[fieldName]?.errors,
                )
                if (!message) {
                  return []
                }
                const label = fieldLabels[fieldName]
                return [label ? `${label}: ${message}` : message]
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
                    {t('admin.hotels.roomModal.error.summaryTitle')}
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="roomNumber">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.roomModal.roomNumber')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.roomModal.roomNumber')}
                  placeholder={t(
                    'admin.hotels.roomModal.roomNumberPlaceholder',
                  )}
                />
              )}
            </form.Field>

            <form.Field name="type">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.roomModal.roomType')}
                  </label>
                  <select
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(event.target.value as RoomType)
                    }
                    onBlur={field.handleBlur}
                    className="admin-select"
                  >
                    <option value="budget">{t('hotel.budgetRoom')}</option>
                    <option value="standard">{t('hotel.standardRoom')}</option>
                    <option value="suite">{t('hotel.suiteRoom')}</option>
                    <option value="deluxe">{t('hotel.deluxeRoom')}</option>
                  </select>
                </div>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="basePrice">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.roomModal.pricePerNight')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.roomModal.pricePerNight')}
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder={t('admin.hotels.roomModal.pricePlaceholder')}
                />
              )}
            </form.Field>

            <form.Field name="maxOccupancy">
              {(field) => (
                <TextField
                  field={field}
                  label={t('admin.hotels.roomModal.maxOccupancy')}
                  labelClassName={labelClass}
                  aria-label={t('admin.hotels.roomModal.maxOccupancy')}
                  type="number"
                  min="1"
                  placeholder={t(
                    'admin.hotels.roomModal.maxOccupancyPlaceholder',
                  )}
                />
              )}
            </form.Field>
          </div>

          <ImageField
            inputAriaLabel={t('admin.hotels.roomModal.roomImageOptional')}
            isDark={isDark}
            label={t('admin.hotels.roomModal.roomImageOptional')}
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
            previewAlt={t('admin.hotels.roomModal.imagePreviewAlt')}
            previewClassName={`h-36 w-full rounded-xl border object-cover ${
              isDark ? 'border-slate-700' : 'border-slate-200'
            }`}
            previewUrl={imageUpload.previewUrl}
            removeLabel={t('common.removeImage')}
          />

          <form.Field name="amenities">
            {(field) => (
              <TextField
                field={field}
                label={t('admin.hotels.roomModal.amenities')}
                labelClassName={labelClass}
                aria-label={t('admin.hotels.roomModal.amenities')}
                placeholder={t('admin.hotels.roomModal.amenitiesPlaceholder')}
              />
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <TextAreaField
                field={field}
                label="Description"
                labelClassName={labelClass}
                aria-label={t('admin.hotels.roomModal.amenitiesPlaceholder')}
                rows={4}
                placeholder="Describe the room setup and experience"
              />
            )}
          </form.Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="bedOptions">
              {(field) => (
                <TextField
                  field={field}
                  label="Bed Options"
                  labelClassName={labelClass}
                  aria-label="Bed Options"
                  placeholder="King bed, twin beds, sofa bed"
                />
              )}
            </form.Field>

            <form.Field name="smokingAllowed">
              {(field) => (
                <label className="flex cursor-pointer items-center gap-3 pt-8">
                  <input
                    type="checkbox"
                    checked={field.state.value}
                    onChange={(event) =>
                      field.handleChange(event.target.checked)
                    }
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
                    Smoking allowed
                  </span>
                </label>
              )}
            </form.Field>
          </div>

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
