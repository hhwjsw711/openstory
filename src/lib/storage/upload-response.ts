/**
 * Upload Response — uploads a fetch Response body to R2,
 * using arrayBuffer() to avoid the triple-copy of blob → arrayBuffer → Buffer.
 */

import type { StorageBucket, UploadResult } from './buckets';
import { uploadFile } from '#storage';

export async function uploadResponse(
  response: Response,
  bucket: StorageBucket,
  path: string,
  options?: { contentType?: string; cacheControl?: string }
): Promise<UploadResult> {
  const arrayBuffer = await response.arrayBuffer();
  return uploadFile(bucket, path, arrayBuffer, { ...options, upsert: true });
}
