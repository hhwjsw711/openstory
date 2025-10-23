/**
 * Storage Helpers
 * Utilities for working with Supabase Storage
 * Storage operations remain with Supabase - only database queries migrate to Drizzle
 */

import { createServerClient } from '@/lib/supabase/server';

/**
 * Storage bucket names
 * Centralized constants to avoid magic strings throughout the codebase
 */
export const STORAGE_BUCKETS = {
  THUMBNAILS: 'thumbnails',
  VIDEOS: 'videos',
  AUDIO: 'audio',
  STYLES: 'styles',
  CHARACTERS: 'characters',
  VFX: 'vfx',
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * Upload result with URL and path information
 */
export type UploadResult = {
  path: string;
  publicUrl: string;
  fullPath: string;
};

/**
 * Get the Supabase storage client
 * Wrapper for consistency with other helpers
 *
 * @returns Supabase storage client
 *
 * @example
 * ```ts
 * const storage = getStorageClient();
 * const { data } = await storage.from('thumbnails').list();
 * ```
 */
export function getStorageClient() {
  const supabase = createServerClient();
  return supabase.storage;
}

/**
 * Upload a file to Supabase Storage
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket (e.g., 'team-id/sequence-id/frame-id.jpg')
 * @param file - The file to upload (File, Blob, or ArrayBuffer)
 * @param options - Optional upload options (upsert, content type, etc.)
 * @returns Upload result with path and public URL
 * @throws Error if upload fails
 *
 * @example
 * ```ts
 * const result = await uploadFile(
 *   STORAGE_BUCKETS.THUMBNAILS,
 *   `${teamId}/${sequenceId}/${frameId}.jpg`,
 *   imageBlob,
 *   { contentType: 'image/jpeg' }
 * );
 * console.log(`Uploaded to: ${result.publicUrl}`);
 * ```
 */
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File | Blob | ArrayBuffer,
  options?: {
    upsert?: boolean;
    contentType?: string;
    cacheControl?: string;
  }
): Promise<UploadResult> {
  const storage = getStorageClient();

  const { data, error } = await storage.from(bucket).upload(path, file, {
    upsert: options?.upsert ?? false,
    contentType: options?.contentType,
    cacheControl: options?.cacheControl ?? '3600',
  });

  if (error) {
    throw new Error(
      `Failed to upload file to ${bucket}/${path}: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(`No data returned from upload to ${bucket}/${path}`);
  }

  const publicUrl = getPublicUrl(bucket, data.path);

  return {
    path: data.path,
    publicUrl,
    fullPath: data.fullPath,
  };
}

/**
 * Get the public URL for a file in storage
 * This works for public buckets. For private buckets, use getSignedUrl instead.
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @returns Public URL for the file
 *
 * @example
 * ```ts
 * const url = getPublicUrl(STORAGE_BUCKETS.THUMBNAILS, 'team-id/frame.jpg');
 * ```
 */
export function getPublicUrl(bucket: StorageBucket, path: string): string {
  const storage = getStorageClient();
  const { data } = storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Get a signed URL for a file (for private buckets or temporary access)
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL for the file
 * @throws Error if signing fails
 *
 * @example
 * ```ts
 * const url = await getSignedUrl(STORAGE_BUCKETS.VIDEOS, 'private/video.mp4', 7200);
 * ```
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn = 3600
): Promise<string> {
  const storage = getStorageClient();
  const { data, error } = await storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(
      `Failed to create signed URL for ${bucket}/${path}: ${error.message}`
    );
  }

  if (!data?.signedUrl) {
    throw new Error(`No signed URL returned for ${bucket}/${path}`);
  }

  return data.signedUrl;
}

/**
 * Delete a file from storage
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @throws Error if deletion fails
 *
 * @example
 * ```ts
 * await deleteFile(STORAGE_BUCKETS.THUMBNAILS, 'team-id/old-frame.jpg');
 * ```
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const storage = getStorageClient();
  const { error } = await storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(
      `Failed to delete file from ${bucket}/${path}: ${error.message}`
    );
  }
}

/**
 * Delete multiple files from storage
 *
 * @param bucket - The storage bucket name
 * @param paths - Array of file paths to delete
 * @throws Error if deletion fails
 *
 * @example
 * ```ts
 * await deleteFiles(STORAGE_BUCKETS.THUMBNAILS, [
 *   'team-id/frame1.jpg',
 *   'team-id/frame2.jpg'
 * ]);
 * ```
 */
export async function deleteFiles(
  bucket: StorageBucket,
  paths: string[]
): Promise<void> {
  const storage = getStorageClient();
  const { error } = await storage.from(bucket).remove(paths);

  if (error) {
    throw new Error(`Failed to delete files from ${bucket}: ${error.message}`);
  }
}

/**
 * List files in a directory
 *
 * @param bucket - The storage bucket name
 * @param path - The directory path to list (empty string for root)
 * @param options - Optional listing options
 * @returns Array of file objects
 * @throws Error if listing fails
 *
 * @example
 * ```ts
 * const files = await listFiles(STORAGE_BUCKETS.THUMBNAILS, 'team-id/sequence-id');
 * console.log(`Found ${files.length} files`);
 * ```
 */
export async function listFiles(
  bucket: StorageBucket,
  path = '',
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: { column: string; order: 'asc' | 'desc' };
  }
) {
  const storage = getStorageClient();
  const { data, error } = await storage.from(bucket).list(path, options);

  if (error) {
    throw new Error(
      `Failed to list files in ${bucket}/${path}: ${error.message}`
    );
  }

  return data ?? [];
}

/**
 * Move or rename a file
 *
 * @param bucket - The storage bucket name
 * @param fromPath - Current file path
 * @param toPath - New file path
 * @throws Error if move fails
 *
 * @example
 * ```ts
 * await moveFile(
 *   STORAGE_BUCKETS.THUMBNAILS,
 *   'team-id/old-name.jpg',
 *   'team-id/new-name.jpg'
 * );
 * ```
 */
export async function moveFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string
): Promise<void> {
  const storage = getStorageClient();
  const { error } = await storage.from(bucket).move(fromPath, toPath);

  if (error) {
    throw new Error(
      `Failed to move file from ${fromPath} to ${toPath}: ${error.message}`
    );
  }
}

/**
 * Copy a file
 *
 * @param bucket - The storage bucket name
 * @param fromPath - Source file path
 * @param toPath - Destination file path
 * @throws Error if copy fails
 *
 * @example
 * ```ts
 * await copyFile(
 *   STORAGE_BUCKETS.THUMBNAILS,
 *   'team-id/original.jpg',
 *   'team-id/copy.jpg'
 * );
 * ```
 */
export async function copyFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string
): Promise<void> {
  const storage = getStorageClient();
  const { error } = await storage.from(bucket).copy(fromPath, toPath);

  if (error) {
    throw new Error(
      `Failed to copy file from ${fromPath} to ${toPath}: ${error.message}`
    );
  }
}

/**
 * Check if a file exists in storage
 *
 * @param bucket - The storage bucket name
 * @param path - The file path to check
 * @returns true if file exists, false otherwise
 *
 * @example
 * ```ts
 * if (await fileExists(STORAGE_BUCKETS.THUMBNAILS, 'team-id/frame.jpg')) {
 *   console.log('File exists!');
 * }
 * ```
 */
export async function fileExists(
  bucket: StorageBucket,
  path: string
): Promise<boolean> {
  try {
    const storage = getStorageClient();
    const { data, error } = await storage.from(bucket).list(path, {
      limit: 1,
    });

    if (error) {
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
