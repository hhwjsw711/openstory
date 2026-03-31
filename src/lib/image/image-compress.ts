/**
 * Image Compression Utility
 * Uses @cf-wasm/photon (WASM-based) to compress images under a size limit.
 * Compatible with Cloudflare Workers (Sharp's native binaries don't work in workerd).
 */

type CompressionResult = {
  buffer: Uint8Array;
  contentType: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
};

const JPEG_QUALITY = 85;

/**
 * Ensure an image is under the given byte limit by converting to JPEG.
 * Returns null if the image is already under the limit.
 */
export async function ensureImageUnderLimit(
  imageUrl: string,
  maxBytes: number
): Promise<CompressionResult | null> {
  // Try HEAD first to check Content-Length without downloading
  const headResponse = await fetch(imageUrl, { method: 'HEAD' });
  const contentLength = headResponse.headers.get('content-length');

  if (contentLength && Number(contentLength) <= maxBytes) {
    return null;
  }

  // Download the image — must buffer fully because WASM's PhotonImage.new_from_byteslice()
  // requires a complete Uint8Array. Bounded by Kling's 9.5MB limit, so peak memory
  // (~original + WASM decode + JPEG output ≈ 43MB) stays well within Workers' 128MB cap.
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image for compression: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const originalSizeBytes = arrayBuffer.byteLength;

  if (originalSizeBytes <= maxBytes) {
    return null;
  }

  console.log(
    `[ImageCompress] Image is ${(originalSizeBytes / 1024 / 1024).toFixed(1)}MB, compressing under ${(maxBytes / 1024 / 1024).toFixed(1)}MB limit`
  );

  // Dynamic import — @cf-wasm/photon's 1.6MB WASM binary uses significant runtime
  // memory when instantiated. Loading it only when compression is actually needed
  // keeps the Worker under the 128MB memory limit for requests that skip compression.
  const { PhotonImage } = await import('@cf-wasm/photon');

  const inputBytes = new Uint8Array(arrayBuffer);
  const inputImage = PhotonImage.new_from_byteslice(inputBytes);

  try {
    const outputBytes = inputImage.get_bytes_jpeg(JPEG_QUALITY);

    if (outputBytes.byteLength > maxBytes) {
      throw new Error(
        `JPEG compression insufficient: ${(outputBytes.byteLength / 1024 / 1024).toFixed(1)}MB still exceeds ${(maxBytes / 1024 / 1024).toFixed(1)}MB limit (original: ${(originalSizeBytes / 1024 / 1024).toFixed(1)}MB)`
      );
    }

    console.log(
      `[ImageCompress] Compressed to ${(outputBytes.byteLength / 1024 / 1024).toFixed(1)}MB (JPEG quality=${JPEG_QUALITY})`
    );

    return {
      buffer: outputBytes,
      contentType: 'image/jpeg',
      originalSizeBytes,
      compressedSizeBytes: outputBytes.byteLength,
    };
  } finally {
    inputImage.free();
  }
}
