import { useCallback, useEffect, useState } from 'react'

import { uploadImageToR2, validateImageFile } from '@/lib/imageUpload'

interface UseImageUploadParams {
  initialR2Key?: string | null
  initialUrl?: string | null
}

interface UploadCommitParams {
  generateUploadUrl: (
    args: Record<string, never>,
  ) => Promise<{ key: string; url: string }>
  syncMetadata: (args: { key: string }) => Promise<unknown>
}

export interface ImageUpdatePayload {
  imageR2Key?: string
  clearImage?: boolean
}

export function useImageUpload({
  initialR2Key = null,
  initialUrl = null,
}: UseImageUploadParams) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState(initialUrl ?? '')
  const [r2Key, setR2Key] = useState<string | null>(initialR2Key)
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
    setR2Key(null)
    setChanged(true)
    setShouldClear(true)
  }, [])

  const commit = useCallback(
    async (params: UploadCommitParams): Promise<string | null> => {
      if (!selectedFile) {
        return r2Key
      }

      setUploading(true)
      try {
        const nextR2Key = await uploadImageToR2({
          file: selectedFile,
          generateUploadUrl: params.generateUploadUrl,
          syncMetadata: params.syncMetadata,
        })

        setSelectedFile(null)
        setR2Key(nextR2Key)
        setShouldClear(false)
        return nextR2Key
      } finally {
        setUploading(false)
      }
    },
    [selectedFile, r2Key],
  )

  const buildUpdatePayload = useCallback(
    (nextR2Key: string | null = r2Key): ImageUpdatePayload => {
      if (!changed) {
        return {}
      }

      if (shouldClear) {
        return { clearImage: true }
      }

      return nextR2Key ? { imageR2Key: nextR2Key } : {}
    },
    [changed, shouldClear, r2Key],
  )

  return {
    buildUpdatePayload,
    changed,
    commit,
    previewUrl,
    remove,
    selectFile,
    selectedFile,
    r2Key,
    uploading,
  }
}
