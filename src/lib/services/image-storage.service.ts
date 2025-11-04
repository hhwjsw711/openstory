/**
 * Image Storage Service
 * Handles uploading and managing images in Supabase Storage
 */

import { createAdminClient } from '@/lib/supabase/server';

interface UploadImageOptions {
  imageUrl: string;
  teamId: string;
  sequenceId: string;
  frameId: string;
}

interface StorageResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * Upload an image from URL to Supabase Storage
 */
export async function uploadImageToStorage(
  options: UploadImageOptions
): Promise<StorageResult> {
  try {
    const { imageUrl, teamId, sequenceId, frameId } = options;
    const supabase = createAdminClient();

    // Construct storage path
    const storagePath = `teams/${teamId}/sequences/${sequenceId}/frames/${frameId}/thumbnail.jpg`;

    // Download image from URL
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const imageBlob = await response.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    const imageData = new Uint8Array(imageBuffer);

    // Determine content type from response or default to jpeg
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('thumbnails')
      .upload(storagePath, imageData, {
        contentType,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    // Generate signed URL for private bucket (1 year expiry)
    const { data, error: signedUrlError } = await supabase.storage
      .from('thumbnails')
      .createSignedUrl(storagePath, 31536000); // 1 year in seconds

    if (signedUrlError) {
      throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
    }

    return {
      success: true,
      url: data.signedUrl,
      path: storagePath,
    };
  } catch (error) {
    console.error('[Image Storage] Upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image',
    };
  }
}

/**
 * Generate a signed URL for temporary image access
 */
export async function getSignedImageUrl(
  path: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<StorageResult> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.storage
      .from('thumbnails')
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return {
      success: true,
      url: data.signedUrl,
      path,
    };
  } catch (error) {
    console.error('[Image Storage] Failed to create signed URL:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to create signed URL',
    };
  }
}

/**
 * Delete an image from storage
 */
export async function deleteImageFromStorage(
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase.storage.from('thumbnails').remove([path]);

    if (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }

    return { success: true };
  } catch (error) {
    console.error('[Image Storage] Failed to delete image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete image',
    };
  }
}

/**
 * List all images for a sequence
 */
export async function listSequenceImages(
  teamId: string,
  sequenceId: string
): Promise<{
  success: boolean;
  images?: Array<{ name: string; size: number; path: string }>;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();
    const folderPath = `teams/${teamId}/sequences/${sequenceId}/frames/`;

    const { data, error } = await supabase.storage
      .from('thumbnails')
      .list(folderPath, {
        limit: 100,
        offset: 0,
      });

    if (error) {
      throw new Error(`Failed to list images: ${error.message}`);
    }

    const images = data
      ?.filter(
        (file) =>
          file.name.endsWith('.jpg') ||
          file.name.endsWith('.jpeg') ||
          file.name.endsWith('.png') ||
          file.name.endsWith('.webp')
      )
      .map((file) => ({
        name: file.name,
        size: file.metadata?.size || 0,
        path: `${folderPath}${file.name}`,
      }));

    return {
      success: true,
      images: images || [],
    };
  } catch (error) {
    console.error('[Image Storage] Failed to list images:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list images',
    };
  }
}

/**
 * Calculate total image storage used by a team
 */
export async function calculateTeamImageStorageUsage(teamId: string): Promise<{
  success: boolean;
  totalBytes?: number;
  totalMB?: number;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();
    const folderPath = `teams/${teamId}/`;

    const { data, error } = await supabase.storage
      .from('thumbnails')
      .list(folderPath, {
        limit: 1000,
        offset: 0,
      });

    if (error) {
      throw new Error(`Failed to calculate storage: ${error.message}`);
    }

    const totalBytes =
      data?.reduce((sum, file) => {
        return sum + (file.metadata?.size || 0);
      }, 0) || 0;

    return {
      success: true,
      totalBytes,
      totalMB: totalBytes / (1024 * 1024),
    };
  } catch (error) {
    console.error('[Image Storage] Failed to calculate storage:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to calculate storage',
    };
  }
}
