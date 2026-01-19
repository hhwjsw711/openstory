/**
 * Langfuse Media Utilities
 * Helpers for attaching images/audio/video to Langfuse traces
 */

import { LangfuseMedia, type MediaContentType } from '@langfuse/core';

// Supported image content types for Langfuse
const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
] as const satisfies readonly MediaContentType[];

type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

// Supported video content types for Langfuse
const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/mpeg',
] as const satisfies readonly MediaContentType[];

type SupportedVideoType = (typeof SUPPORTED_VIDEO_TYPES)[number];

/**
 * Check if a string is a supported image MediaContentType
 */
function isSupportedImageType(type: string): type is SupportedImageType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/**
 * Check if a string is a supported video MediaContentType
 */
function isSupportedVideoType(type: string): type is SupportedVideoType {
  return (SUPPORTED_VIDEO_TYPES as readonly string[]).includes(type);
}

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
    const mimeType = rawContentType.split(';')[0].trim();

    const arrayBuffer = await response.arrayBuffer();

    if (!isSupportedImageType(mimeType)) {
      // Default to PNG for unknown types
      return new LangfuseMedia({
        source: 'bytes',
        contentBytes: Buffer.from(arrayBuffer),
        contentType: 'image/png',
      });
    }

    return new LangfuseMedia({
      source: 'bytes',
      contentBytes: Buffer.from(arrayBuffer),
      contentType: mimeType,
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
    const mimeType = rawContentType.split(';')[0].trim();

    const arrayBuffer = await response.arrayBuffer();

    if (!isSupportedVideoType(mimeType)) {
      // Default to MP4 for unknown video types
      return new LangfuseMedia({
        source: 'bytes',
        contentBytes: Buffer.from(arrayBuffer),
        contentType: 'video/mp4',
      });
    }

    return new LangfuseMedia({
      source: 'bytes',
      contentBytes: Buffer.from(arrayBuffer),
      contentType: mimeType,
    });
  } catch {
    return null;
  }
}
