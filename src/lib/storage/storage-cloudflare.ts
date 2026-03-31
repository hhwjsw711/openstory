/**
 * Storage Cloudflare — Native R2 binding implementation.
 * Used on Cloudflare Workers via the workerd condition in package.json imports.
 *
 * Signed URLs are not supported by R2 bindings and lazy-import the S3 SDK.
 */

import { getEnv } from '../env/cloudflare';
import {
  buildR2Key,
  getPublicUrl,
  type StorageBucket,
  type StorageFileInfo,
  type UploadResult,
} from './buckets';

function getR2Bucket(): R2Bucket {
  const bucket = getEnv().R2_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error(
      'R2 binding "R2_STORAGE_BUCKET" not found. Ensure r2_buckets is configured in wrangler.jsonc'
    );
  }
  return bucket;
}

export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File | Blob | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
  options?: {
    upsert?: boolean;
    contentType?: string;
    cacheControl?: string;
  }
): Promise<UploadResult> {
  const r2 = getR2Bucket();
  const key = buildR2Key(bucket, path);

  try {
    // R2 natively accepts all types in our union (ReadableStream, ArrayBuffer,
    // ArrayBufferView, Blob) — no conversion needed.
    await r2.put(key, file, {
      httpMetadata: {
        contentType: options?.contentType,
        cacheControl: options?.cacheControl ?? 'public, max-age=31536000',
      },
    });

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

export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  _expiresIn = 3600
): Promise<string> {
  // R2 files are publicly accessible via CDN — no signing needed on Cloudflare.
  // The S3 SDK fallback previously here pulled ~19MB of @aws-sdk into the Worker
  // bundle, contributing to OOM (error 1102) on the 128MB Workers memory limit.
  return getPublicUrl(bucket, path);
}

export async function getSignedUrlWithDownload(
  bucket: StorageBucket,
  path: string,
  _filename: string,
  _expiresIn = 3600
): Promise<string> {
  // R2 files are publicly accessible — return public URL.
  // Custom download filename (ResponseContentDisposition) is not supported
  // without S3 presigned URLs, but keeping the AWS SDK out of the Worker
  // bundle is worth the trade-off. Browser "Save As" still works.
  return getPublicUrl(bucket, path);
}

export async function getSignedUploadUrl(
  bucket: StorageBucket,
  path: string,
  contentType: string,
  _expiresIn = 600
): Promise<{
  uploadUrl: string;
  publicUrl: string;
  path: string;
  contentType: string;
}> {
  // R2 bindings don't support presigned URLs — proxy through the worker instead
  // Pass raw path — uploadFile will call buildR2Key itself
  const params = new URLSearchParams({ bucket, path, contentType });
  const uploadUrl = `/api/storage/upload?${params}`;
  const publicUrl = getPublicUrl(bucket, path);
  return { uploadUrl, publicUrl, path: buildR2Key(bucket, path), contentType };
}

export async function deleteFile(
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const r2 = getR2Bucket();
  const key = buildR2Key(bucket, path);

  try {
    await r2.delete(key);
  } catch (error) {
    throw new Error(
      `Failed to delete file from ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function deleteFiles(
  bucket: StorageBucket,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;

  const r2 = getR2Bucket();

  try {
    const keys = paths.map((path) => buildR2Key(bucket, path));
    await r2.delete(keys);
  } catch (error) {
    throw new Error(
      `Failed to delete files from ${bucket}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function listFiles(
  bucket: StorageBucket,
  path = '',
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: { column: string; order: 'asc' | 'desc' };
  }
): Promise<StorageFileInfo[]> {
  const r2 = getR2Bucket();
  const prefix = buildR2Key(bucket, path);

  try {
    const listed = await r2.list({
      prefix,
      limit: options?.limit,
      include: ['httpMetadata'],
    });

    return listed.objects.map((obj) => ({
      name: obj.key.replace(`${prefix}/`, ''),
      id: obj.key,
      updated_at: obj.uploaded.toISOString(),
      created_at: obj.uploaded.toISOString(),
      last_accessed_at: obj.uploaded.toISOString(),
      metadata: {
        size: obj.size,
        mimetype: obj.httpMetadata?.contentType ?? '',
        cacheControl: obj.httpMetadata?.cacheControl ?? '',
        eTag: obj.httpEtag,
      },
    }));
  } catch (error) {
    throw new Error(
      `Failed to list files in ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function moveFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string
): Promise<void> {
  await copyFile(bucket, fromPath, toPath);
  await deleteFile(bucket, fromPath);
}

export async function copyFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string
): Promise<void> {
  const r2 = getR2Bucket();
  const sourceKey = buildR2Key(bucket, fromPath);
  const destKey = buildR2Key(bucket, toPath);

  try {
    const source = await r2.get(sourceKey);
    if (!source) {
      throw new Error(`Source file not found: ${fromPath}`);
    }

    await r2.put(destKey, source.body, {
      httpMetadata: source.httpMetadata,
      customMetadata: source.customMetadata,
    });
  } catch (error) {
    throw new Error(
      `Failed to copy file from ${fromPath} to ${toPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function fileExists(
  bucket: StorageBucket,
  path: string
): Promise<boolean> {
  const r2 = getR2Bucket();
  const key = buildR2Key(bucket, path);

  try {
    const head = await r2.head(key);
    return head !== null;
  } catch {
    return false;
  }
}
