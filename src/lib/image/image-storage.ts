/**
 * Image Storage Service
 * Handles uploading and managing images in R2 Storage
 */

import { STORAGE_BUCKETS } from '@/lib/storage/buckets';
import { deleteFile, getSignedUrl, listFiles, uploadFile } from '#storage';
import { uploadResponse } from '@/lib/storage/upload-response';
import {
  getExtensionFromUrl,
  getMimeTypeFromExtension,
} from '@/lib/utils/file';
import { generateId } from '@/lib/db/id';

interface UploadImageOptions {
  imageUrl: string;
  teamId: string;
  sequenceId: string;
  frameId: string;
}

interface UploadImageBufferOptions {
  imageBuffer: Uint8Array;
  teamId: string;
  sequenceId: string;
  frameId: string;
  contentType: string;
}

type StorageResult = {
  url: string;
  path: string;
};

/**
 * Upload an image from URL to R2 Storage
 * Uses ULID-based filename and preserves original file extension
 */
export async function uploadImageToStorage(
  options: UploadImageOptions
): Promise<StorageResult> {
  const { imageUrl, teamId, sequenceId, frameId } = options;

  // Download image from URL first to get content type
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  // Extract extension from URL or use response content-type
  const urlExtension = getExtensionFromUrl(imageUrl);
  const responseContentType = response.headers.get('content-type');

  // Prefer URL extension, fallback to content-type detection
  let extension = urlExtension;
  if (urlExtension === 'jpg' && responseContentType) {
    // If we defaulted to jpg, check if content-type suggests otherwise
    if (responseContentType.includes('png')) extension = 'png';
    else if (responseContentType.includes('webp')) extension = 'webp';
    else if (responseContentType.includes('gif')) extension = 'gif';
  }

  // Generate ULID-based filename
  const ulid = generateId();
  const storagePath = `teams/${teamId}/sequences/${sequenceId}/frames/${frameId}/${ulid}.${extension}`;

  // Get proper MIME type for the extension
  const contentType = getMimeTypeFromExtension(extension);

  // Stream directly to R2 Storage (avoids buffering entire image in memory)
  const result = await uploadResponse(
    response,
    STORAGE_BUCKETS.THUMBNAILS,
    storagePath,
    {
      contentType,
    }
  );

  return {
    url: result.publicUrl,
    path: storagePath,
  };
}

/**
 * Upload an image buffer directly to R2 Storage
 * Used when we have the image data in memory (e.g., after cropping with Sharp)
 */
export async function uploadImageBufferToStorage(
  options: UploadImageBufferOptions
): Promise<StorageResult> {
  const { imageBuffer, teamId, sequenceId, frameId, contentType } = options;

  // Determine extension from content type
  let extension = 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    extension = 'jpg';
  } else if (contentType.includes('webp')) {
    extension = 'webp';
  } else if (contentType.includes('gif')) {
    extension = 'gif';
  }

  // Generate ULID-based filename
  const ulid = generateId();
  const storagePath = `teams/${teamId}/sequences/${sequenceId}/frames/${frameId}/${ulid}.${extension}`;

  // Pass Uint8Array view directly as ArrayBuffer — avoids Blob wrapper round-trip
  const result = await uploadFile(
    STORAGE_BUCKETS.THUMBNAILS,
    storagePath,
    new Uint8Array(imageBuffer).buffer,
    {
      contentType,
      upsert: true,
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
