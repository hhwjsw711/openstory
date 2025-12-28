/**
 * Langfuse Media Utilities
 * Helpers for attaching images/audio/video to Langfuse traces
 */

import { LangfuseMedia, MediaContentType } from '@langfuse/core';

// Supported image content types for Langfuse
const SUPPORTED_IMAGE_TYPES = new Set<MediaContentType>([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

// Supported video content types for Langfuse
const SUPPORTED_VIDEO_TYPES = new Set<MediaContentType>([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/mpeg',
]);

/**
 * Fetch image from URL and wrap in LangfuseMedia for inline display in traces.
 * Returns null if fetch fails or content type is not a supported image type.
 */
export async function createImageMedia(
  url: string
): Promise<LangfuseMedia | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    // Check content type is a supported image type
    const rawContentType = response.headers.get('content-type') || 'image/png';
    // Extract the MIME type without charset or other parameters
    const contentType = rawContentType.split(';')[0].trim() as MediaContentType;

    if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
      // Default to PNG for unknown types
      const arrayBuffer = await response.arrayBuffer();
      return new LangfuseMedia({
        source: 'bytes',
        contentBytes: Buffer.from(arrayBuffer),
        contentType: 'image/png',
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    return new LangfuseMedia({
      source: 'bytes',
      contentBytes: Buffer.from(arrayBuffer),
      contentType,
    });
  } catch {
    return null;
  }
}

/**
 * Fetch video from URL and wrap in LangfuseMedia for traces.
 * Returns null if fetch fails or content type is not a supported video type.
 */
export async function createVideoMedia(
  url: string
): Promise<LangfuseMedia | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    // Check content type is a supported video type
    const rawContentType = response.headers.get('content-type') || 'video/mp4';
    // Extract the MIME type without charset or other parameters
    const contentType = rawContentType.split(';')[0].trim() as MediaContentType;

    if (!SUPPORTED_VIDEO_TYPES.has(contentType)) {
      // Default to MP4 for unknown video types
      const arrayBuffer = await response.arrayBuffer();
      return new LangfuseMedia({
        source: 'bytes',
        contentBytes: Buffer.from(arrayBuffer),
        contentType: 'video/mp4',
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    return new LangfuseMedia({
      source: 'bytes',
      contentBytes: Buffer.from(arrayBuffer),
      contentType,
    });
  } catch {
    return null;
  }
}
