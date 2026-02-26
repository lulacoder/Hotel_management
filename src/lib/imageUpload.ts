import type { Id } from '../../convex/_generated/dataModel'

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export function validateImageFile(file: File): string | null {
  // Check if the file type starts with image/
  if (!file.type.startsWith('image/')) {
    return 'Please select a valid image file.'
  }

  // Check if the file size exceeds the 10MB limit
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
  // Request a specific upload URL from Convex
  const uploadUrl = await params.generateUploadUrl({
    clerkUserId: params.clerkUserId,
  })

  // POST the file data to the generated upload URL
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': params.file.type },
    body: params.file,
  })

  // Throw an error if the upload request failed
  if (!uploadResponse.ok) {
    throw new Error('Failed to upload image file.')
  }

  // Parse response to extract the unique storageId
  const payload = (await uploadResponse.json()) as { storageId?: Id<'_storage'> }
  if (!payload.storageId) {
    throw new Error('Upload completed without a storage ID.')
  }

  // Track the upload by linking the storageId to the user
  await params.trackUpload({
    clerkUserId: params.clerkUserId,
    storageId: payload.storageId,
  })

  // Return the storageId for use in the UI/database
  return payload.storageId
}
