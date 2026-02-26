/**
 * Storage Helpers
 * Utilities for working with Cloudflare R2 Storage
 * Migrated from Supabase Storage to R2 for better performance and cost efficiency
 *
 * MULTI-PLATFORM COMPATIBILITY:
 * - Uses AWS S3 SDK for R2 access (works on Vercel, Railway, Cloudflare Workers)
 * - Cloudflare Workers: Requires nodejs_compat flag (configured in wrangler.toml)
 * - Alternative: Native R2 bindings on Cloudflare (future optimization for performance)
 *
 * The S3 SDK provides cross-platform compatibility at the cost of larger bundle size.
 * For Cloudflare-specific optimization, consider using native R2 bindings via:
 * getEnv().OPENSTORY_STORAGE (configured in wrangler.toml as [[r2_buckets]])
 */

import { getEnv } from '#env';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
/**
 * Storage bucket names
 * These are now used as prefixes in a single R2 bucket
 */
export const STORAGE_BUCKETS = {
  THUMBNAILS: 'thumbnails',
  VIDEOS: 'videos',
  AUDIO: 'audio',
  STYLES: 'styles',
  CHARACTERS: 'characters',
  LOCATIONS: 'locations',
  TALENT: 'talent',
  VFX: 'vfx',
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * Upload result with URL and path information
 */
type UploadResult = {
  path: string;
  publicUrl: string;
  fullPath: string;
};

/**
 * Create an S3 client configured for Cloudflare R2
 */
function createR2Client(): S3Client {
  const accountId = getEnv().R2_ACCOUNT_ID;
  const accessKeyId = getEnv().R2_ACCESS_KEY_ID;
  const secretAccessKey = getEnv().R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing required R2 environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY'
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Get the R2 bucket name from environment
 */
function getR2BucketName(): string {
  const bucketName = getEnv().R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set');
  }
  return bucketName;
}

/**
 * Build the full R2 key with bucket prefix
 * R2 uses a single bucket with prefixes instead of multiple buckets
 */
function buildR2Key(bucket: StorageBucket, path: string): string {
  return `${bucket}/${path}`;
}

/**
 * Upload a file to R2 Storage
 *
 * @param bucket - The storage bucket name (used as prefix)
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
  const client = createR2Client();
  const bucketName = getR2BucketName();
  const key = buildR2Key(bucket, path);

  try {
    // Convert file to Buffer if needed
    let body: Buffer | Uint8Array;
    if (file instanceof ArrayBuffer) {
      body = Buffer.from(file);
    } else {
      // file is Blob or File
      const arrayBuffer = await file.arrayBuffer();
      body = Buffer.from(arrayBuffer);
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: options?.contentType,
      CacheControl: options?.cacheControl ?? 'public, max-age=31536000', // 1 year default
    });

    await client.send(command);

    // Generate public URL (requires R2_PUBLIC_STORAGE_DOMAIN to be configured)
    const publicUrl = getPublicUrl(bucket, path);

    return {
      path: key,
      publicUrl,
      fullPath: key,
    };
  } catch (error) {
    throw new Error(
      `Failed to upload file to ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get the public URL for a file in storage
 * Requires R2 bucket to have public access enabled with a custom domain
 *
 * @param bucket - The storage bucket name (used as prefix)
 * @param path - The file path within the bucket
 * @returns Public URL for the file
 *
 * @example
 * ```ts
 * const url = getPublicUrl(STORAGE_BUCKETS.THUMBNAILS, 'team-id/frame.jpg');
 * // Returns: https://{R2_PUBLIC_STORAGE_DOMAIN}/thumbnails/team-id/frame.jpg
 * ```
 */
export function getPublicUrl(bucket: StorageBucket, path: string): string {
  const domain = getEnv().R2_PUBLIC_STORAGE_DOMAIN;
  if (!domain) {
    throw new Error(
      'R2_PUBLIC_STORAGE_DOMAIN environment variable is not set. Configure a custom domain for public R2 access.'
    );
  }
  const key = buildR2Key(bucket, path);
  return `https://${domain}/${key}`;
}

/**
 * Extract the storage path from a public URL
 * Inverse of getPublicUrl
 *
 * @param url - The public URL
 * @param bucket - The storage bucket the file is in
 * @returns The path within the bucket
 *
 * @example
 * ```ts
 * getPathFromUrl('https://{R2_PUBLIC_STORAGE_DOMAIN}/talent/team-id/temp/file.jpg', STORAGE_BUCKETS.TALENT);
 * // Returns: 'team-id/temp/file.jpg'
 * ```
 */
export function getPathFromUrl(url: string, bucket: StorageBucket): string {
  const domain = getEnv().R2_PUBLIC_STORAGE_DOMAIN;
  if (!domain) {
    throw new Error('R2_PUBLIC_STORAGE_DOMAIN environment variable is not set');
  }
  const prefix = `https://${domain}/${bucket}/`;
  if (!url.startsWith(prefix)) {
    throw new Error(`URL does not match expected bucket format: ${url}`);
  }
  return url.slice(prefix.length);
}

/**
 * Extract file extension from a URL
 * Handles URLs with query parameters and fragments
 *
 * @param url - Source URL to extract extension from
 * @returns Lowercase file extension (e.g., 'jpg', 'png', 'mp4')
 *
 * @example
 * ```ts
 * getExtensionFromUrl('https://example.com/image.PNG?token=abc');
 * // Returns: 'png'
 * ```
 */
export function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match?.[1]?.toLowerCase() || 'jpg';
  } catch {
    // If URL parsing fails, try simple regex
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
    return match?.[1]?.toLowerCase() || 'jpg';
  }
}

/**
 * Get MIME type from file extension
 *
 * @param ext - File extension (without dot)
 * @returns MIME type string
 *
 * @example
 * ```ts
 * getMimeTypeFromExtension('png'); // Returns: 'image/png'
 * getMimeTypeFromExtension('mp4'); // Returns: 'video/mp4'
 * ```
 */
export function getMimeTypeFromExtension(ext: string): string {
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    // Videos
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
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
  const client = createR2Client();
  const bucketName = getR2BucketName();
  const key = buildR2Key(bucket, path);

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const url = await getS3SignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    throw new Error(
      `Failed to create signed URL for ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a signed URL for downloading a file with a custom filename
 * Uses AWS ResponseContentDisposition to force browser download with specified filename
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param filename - The filename to use for download (e.g., 'my-video_openstory.mp4')
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL with Content-Disposition header for download
 * @throws Error if signing fails
 *
 * @example
 * ```ts
 * const url = await getSignedUrlWithDownload(
 *   STORAGE_BUCKETS.VIDEOS,
 *   'teams/123/video.mp4',
 *   'desert-scene_openstory.mp4',
 *   7200
 * );
 * ```
 */
export async function getSignedUrlWithDownload(
  bucket: StorageBucket,
  path: string,
  filename: string,
  expiresIn = 3600
): Promise<string> {
  const client = createR2Client();
  const bucketName = getR2BucketName();
  const key = buildR2Key(bucket, path);

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });

    const url = await getS3SignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    throw new Error(
      `Failed to create download URL for ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
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
  const client = createR2Client();
  const bucketName = getR2BucketName();
  const key = buildR2Key(bucket, path);

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await client.send(command);
  } catch (error) {
    throw new Error(
      `Failed to delete file from ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
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
  if (paths.length === 0) return;

  const client = createR2Client();
  const bucketName = getR2BucketName();

  try {
    const command = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: paths.map((path) => ({ Key: buildR2Key(bucket, path) })),
      },
    });

    await client.send(command);
  } catch (error) {
    throw new Error(
      `Failed to delete files from ${bucket}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
  const client = createR2Client();
  const bucketName = getR2BucketName();
  const prefix = buildR2Key(bucket, path);

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: options?.limit,
    });

    const response = await client.send(command);

    return (
      response.Contents?.map((item) => ({
        name: item.Key?.replace(`${prefix}/`, '') ?? '',
        id: item.Key ?? '',
        updated_at: item.LastModified?.toISOString() ?? '',
        created_at: item.LastModified?.toISOString() ?? '',
        last_accessed_at: item.LastModified?.toISOString() ?? '',
        metadata: {
          size: item.Size ?? 0,
          mimetype: '',
          cacheControl: '',
          eTag: item.ETag ?? '',
        },
      })) ?? []
    );
  } catch (error) {
    throw new Error(
      `Failed to list files in ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Move or rename a file
 * In R2, this is implemented as copy + delete
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
  await copyFile(bucket, fromPath, toPath);
  await deleteFile(bucket, fromPath);
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
  const client = createR2Client();
  const bucketName = getR2BucketName();
  const sourceKey = buildR2Key(bucket, fromPath);
  const destKey = buildR2Key(bucket, toPath);

  try {
    const command = new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${sourceKey}`,
      Key: destKey,
    });

    await client.send(command);
  } catch (error) {
    throw new Error(
      `Failed to copy file from ${fromPath} to ${toPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
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
  const client = createR2Client();
  const bucketName = getR2BucketName();
  const key = buildR2Key(bucket, path);

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch {
    return false;
  }
}
