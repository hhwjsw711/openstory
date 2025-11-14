/**
 * Image Storage Service
 * Handles uploading and managing images in R2 Storage
 */

import {
  deleteFile,
  getSignedUrl,
  listFiles,
  STORAGE_BUCKETS,
  uploadFile,
} from '@/lib/db/helpers/storage';

interface UploadImageOptions {
  imageUrl: string;
  teamId: string;
  sequenceId: string;
  frameId: string;
}

type StorageResult = {
  url: string;
  path: string;
};

/**
 * Upload an image from URL to R2 Storage
 */
export async function uploadImageToStorage(
  options: UploadImageOptions
): Promise<StorageResult> {
  const { imageUrl, teamId, sequenceId, frameId } = options;

  // Construct storage path
  const storagePath = `teams/${teamId}/sequences/${sequenceId}/frames/${frameId}/thumbnail.jpg`;

  // Download image from URL
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const imageBlob = await response.blob();

  // Determine content type from response or default to jpeg
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  // Upload to R2 Storage
  const result = await uploadFile(
    STORAGE_BUCKETS.THUMBNAILS,
    storagePath,
    imageBlob,
    {
      contentType,
      upsert: true, // Overwrite if exists
    }
  );

  return {
    url: result.publicUrl,
    path: storagePath,
  };
}

/**
 * Generate a signed URL for temporary image access
 */
export async function getSignedImageUrl(
  path: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  return await getSignedUrl(STORAGE_BUCKETS.THUMBNAILS, path, expiresIn);
}

/**
 * Delete an image from storage
 */
export async function deleteImageFromStorage(
  path: string
): Promise<{ success: boolean; error?: string }> {
  await deleteFile(STORAGE_BUCKETS.THUMBNAILS, path);

  return { success: true };
}

/**
 * List all images for a sequence
 */
export async function listSequenceImages(
  teamId: string,
  sequenceId: string
): Promise<{
  images?: Array<{ name: string; size: number; path: string }>;
}> {
  const folderPath = `teams/${teamId}/sequences/${sequenceId}/frames/`;

  const files = await listFiles(STORAGE_BUCKETS.THUMBNAILS, folderPath, {
    limit: 100,
  });

  const images = files
    .filter(
      (file) =>
        file.name.endsWith('.jpg') ||
        file.name.endsWith('.jpeg') ||
        file.name.endsWith('.png') ||
        file.name.endsWith('.webp')
    )
    .map((file) => ({
      name: file.name,
      size: file.metadata.size,
      path: file.id,
    }));

  return {
    images,
  };
}

/**
 * Calculate total image storage used by a team
 */
export async function calculateTeamImageStorageUsage(teamId: string): Promise<{
  totalBytes: number;
  totalMB: number;
}> {
  const folderPath = `teams/${teamId}/`;

  const files = await listFiles(STORAGE_BUCKETS.THUMBNAILS, folderPath, {
    limit: 1000,
  });

  const totalBytes = files.reduce((sum, file) => {
    return sum + file.metadata.size;
  }, 0);

  return {
    totalBytes,
    totalMB: totalBytes / (1024 * 1024),
  };
}
