/**
 * Upload Response — streams a fetch Response body directly to R2 when possible,
 * falling back to buffered upload when Content-Length is unknown.
 */

import type { StorageBucket, UploadResult } from './buckets';
import { uploadFile, uploadStream } from '#storage';

export async function uploadResponse(
  response: Response,
  bucket: StorageBucket,
  path: string,
  options?: { contentType?: string; cacheControl?: string }
): Promise<UploadResult> {
  const contentLength = Number(response.headers.get('content-length'));

  // Stream directly when Content-Length is known
  if (contentLength > 0 && response.body) {
    return uploadStream(bucket, path, response.body, contentLength, options);
  }

  // Fallback: buffer if Content-Length unknown
  const blob = await response.blob();
  return uploadFile(bucket, path, blob, { ...options, upsert: true });
}
