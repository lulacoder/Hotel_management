import type { Id } from '../../convex/_generated/dataModel'

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please select a valid image file.'
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Image must be 10MB or smaller.'
  }

  return null
}

export async function uploadImageToConvex(params: {
  file: File
  clerkUserId: string
  generateUploadUrl: (args: { clerkUserId: string }) => Promise<string>
  trackUpload: (args: {
    clerkUserId: string
    storageId: Id<'_storage'>
  }) => Promise<null>
}): Promise<Id<'_storage'>> {
  const uploadUrl = await params.generateUploadUrl({
    clerkUserId: params.clerkUserId,
  })

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': params.file.type },
    body: params.file,
  })

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload image file.')
  }

  const payload = (await uploadResponse.json()) as { storageId?: Id<'_storage'> }
  if (!payload.storageId) {
    throw new Error('Upload completed without a storage ID.')
  }

  await params.trackUpload({
    clerkUserId: params.clerkUserId,
    storageId: payload.storageId,
  })

  return payload.storageId
}
