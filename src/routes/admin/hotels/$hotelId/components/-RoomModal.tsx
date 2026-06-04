import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@/integrations/convex/hooks'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { useUser } from '@clerk/clerk-react'

import { api } from '../../../../../../convex/_generated/api'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import {
  uploadImageToConvex,
  validateImageFile,
} from '../../../../../lib/imageUpload'
import { useI18n } from '../../../../../lib/i18n/provider'
import { useTheme } from '../../../../../lib/theme'

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
        amenities?: string[]
        description?: string
        bedOptions?: string
        smokingAllowed?: boolean
        imageUrl?: string
        imageStorageId?: Id<'_storage'>
      }
    | null
    | undefined,
): RoomFormValues {
  return {
    roomNumber: room?.roomNumber ?? '',
    type: room?.type ?? 'budget',
    basePrice: room ? (room.basePrice / 100).toString() : '',
    maxOccupancy: room?.maxOccupancy?.toString() ?? '',
    amenities: room?.amenities?.join(', ') ?? '',
    description: room?.description ?? '',
    bedOptions: room?.bedOptions ?? '',
    smokingAllowed: room?.smokingAllowed ?? false,
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
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(room?.imageUrl ?? '')
  const [imageStorageId, setImageStorageId] = useState<Id<'_storage'> | null>(
    room?.imageStorageId ?? null,
  )
  const [imageChanged, setImageChanged] = useState(false)
  const [clearImage, setClearImage] = useState(false)

  const schema = useMemo(
    () =>
      z.object({
        roomNumber: z.string().trim().min(1, 'Room number is required.'),
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
            return Number.isFinite(parsed) && parsed > 0
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
      } finally {
        setUploadingImage(false)
      }
    },
  })

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const roomNumberError = getFirstErrorMessage(
    form.getFieldMeta('roomNumber')?.errors,
  )
  const basePriceError = getFirstErrorMessage(
    form.getFieldMeta('basePrice')?.errors,
  )
  const maxOccupancyError = getFirstErrorMessage(
    form.getFieldMeta('maxOccupancy')?.errors,
  )
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="roomNumber">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.roomModal.roomNumber')}
                  </label>
                  <input
                    aria-label={t('admin.hotels.roomModal.roomNumber')}
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t(
                      'admin.hotels.roomModal.roomNumberPlaceholder',
                    )}
                    className={`admin-field ${
                      roomNumberError
                        ? 'border-red-500/60 focus:border-red-500/80'
                        : ''
                    }`}
                  />
                  {roomNumberError ? (
                    <p className="mt-2 text-xs text-red-400">
                      {roomNumberError}
                    </p>
                  ) : null}
                </div>
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
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.roomModal.pricePerNight')}
                  </label>
                  <input
                    aria-label={t('admin.hotels.roomModal.pricePerNight')}
                    type="number"
                    min="1"
                    step="0.01"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('admin.hotels.roomModal.pricePlaceholder')}
                    className={`admin-field ${
                      basePriceError
                        ? 'border-red-500/60 focus:border-red-500/80'
                        : ''
                    }`}
                  />
                  {basePriceError ? (
                    <p className="mt-2 text-xs text-red-400">
                      {basePriceError}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <form.Field name="maxOccupancy">
              {(field) => (
                <div>
                  <label className={labelClass}>
                    {t('admin.hotels.roomModal.maxOccupancy')}
                  </label>
                  <input
                    aria-label={t('admin.hotels.roomModal.maxOccupancy')}
                    type="number"
                    min="1"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t(
                      'admin.hotels.roomModal.maxOccupancyPlaceholder',
                    )}
                    className={`admin-field ${
                      maxOccupancyError
                        ? 'border-red-500/60 focus:border-red-500/80'
                        : ''
                    }`}
                  />
                  {maxOccupancyError ? (
                    <p className="mt-2 text-xs text-red-400">
                      {maxOccupancyError}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>
          </div>

          <div>
            <label className={labelClass}>
              {t('admin.hotels.roomModal.roomImageOptional')}
            </label>
            <input
              aria-label={t('admin.hotels.roomModal.roomImageOptional')}
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
                  alt={t('admin.hotels.roomModal.imagePreviewAlt')}
                  className={`h-36 w-full rounded-xl border object-cover ${
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

          <form.Field name="amenities">
            {(field) => (
              <div>
                <label className={labelClass}>
                  {t('admin.hotels.roomModal.amenities')}
                </label>
                <input
                  aria-label={t('admin.hotels.roomModal.amenities')}
                  type="text"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.hotels.roomModal.amenitiesPlaceholder')}
                  className="admin-field"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div>
                <label htmlFor="room-description" className={labelClass}>
                  Description
                </label>
                <textarea
                  id="room-description"
                  aria-label={t('admin.hotels.roomModal.amenitiesPlaceholder')}
                  rows={4}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Describe the room setup and experience"
                  className="admin-textarea"
                />
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="bedOptions">
              {(field) => (
                <div>
                  <label htmlFor="room-bed-options" className={labelClass}>
                    Bed Options
                  </label>
                  <input
                    id="room-bed-options"
                    aria-label="Bed Options"
                    type="text"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="King bed, twin beds, sofa bed"
                    className="admin-field"
                  />
                </div>
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
            <button
              type="submit"
              disabled={isSubmitting || uploadingImage}
              className="admin-button-primary flex-1 disabled:opacity-50"
            >
              {isSubmitting || uploadingImage
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
