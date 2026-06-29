import { useCallback, useEffect, useState } from 'react'

import type { Id } from '../../convex/_generated/dataModel'
import { uploadImageToConvex, validateImageFile } from '@/lib/imageUpload'

interface UseImageUploadParams {
  initialStorageId?: Id<'_storage'> | null
  initialUrl?: string | null
}

interface UploadCommitParams {
  generateUploadUrl: (args: Record<string, never>) => Promise<string>
  trackUpload: (args: { storageId: Id<'_storage'> }) => Promise<null>
}

export interface ImageUpdatePayload {
  imageStorageId?: Id<'_storage'>
  clearImage?: boolean
}

export function useImageUpload({
  initialStorageId = null,
  initialUrl = null,
}: UseImageUploadParams) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState(initialUrl ?? '')
  const [storageId, setStorageId] = useState<Id<'_storage'> | null>(
    initialStorageId,
  )
  const [changed, setChanged] = useState(false)
  const [shouldClear, setShouldClear] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!previewUrl.startsWith('blob:')) {
      return
    }

    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const selectFile = useCallback((file: File): string | null => {
    const validationError = validateImageFile(file)
    if (validationError) {
      return validationError
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setChanged(true)
    setShouldClear(false)
    return null
  }, [])

  const remove = useCallback(() => {
    setSelectedFile(null)
    setPreviewUrl('')
    setStorageId(null)
    setChanged(true)
    setShouldClear(true)
  }, [])

  const commit = useCallback(
    async (params: UploadCommitParams): Promise<Id<'_storage'> | null> => {
      if (!selectedFile) {
        return storageId
      }

      setUploading(true)
      try {
        const nextStorageId = await uploadImageToConvex({
          file: selectedFile,
          generateUploadUrl: params.generateUploadUrl,
          trackUpload: params.trackUpload,
        })

        setStorageId(nextStorageId)
        setShouldClear(false)
        return nextStorageId
      } finally {
        setUploading(false)
      }
    },
    [selectedFile, storageId],
  )

  const buildUpdatePayload = useCallback(
    (nextStorageId: Id<'_storage'> | null = storageId): ImageUpdatePayload => {
      if (!changed) {
        return {}
      }

      if (shouldClear) {
        return { clearImage: true }
      }

      return nextStorageId ? { imageStorageId: nextStorageId } : {}
    },
    [changed, shouldClear, storageId],
  )

  return {
    buildUpdatePayload,
    changed,
    commit,
    previewUrl,
    remove,
    selectFile,
    selectedFile,
    storageId,
    uploading,
  }
}
