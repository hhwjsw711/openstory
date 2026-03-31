/**
 * Upload Response — streams a fetch Response body directly to R2/S3,
 * passing the ReadableStream to avoid buffering the entire file in memory.
 *
 * On Cloudflare Workers: R2 binding natively accepts ReadableStream.
 * On local dev (Bun): Bun's native S3 client handles streaming uploads.
 */

import type { StorageBucket, UploadResult } from './buckets';
import { uploadFile } from '#storage';

export async function uploadResponse(
  response: Response,
  bucket: StorageBucket,
  path: string,
  options?: { contentType?: string; cacheControl?: string }
): Promise<UploadResult> {
  const body = response.body;
  if (!body) {
    throw new Error('Response body is null — cannot upload empty response');
  }
  return uploadFile(bucket, path, body, { ...options, upsert: true });
}
