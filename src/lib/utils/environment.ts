/**
 * Environment utility functions for checking feature availability
 * based on environment variables and deployment context.
 */

/**
 * Check if Google OAuth is enabled based on environment configuration.
 * Matches the logic from Better Auth config (src/lib/auth/config.ts).
 *
 * Google OAuth is enabled when:
 * 1. Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are present
 * 2. AND either:
 *    - VERCEL_ENV === 'production' (production deployments)
 *    - NODE_ENV === 'development' (local development)
 *
 * This means Google OAuth is DISABLED on Vercel preview branches.
 */
export function isGoogleOAuthEnabled(): boolean {
  const isProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return isProduction || isDevelopment;
}

/**
 * Check if we're running in local development environment
 * Detected by checking if Supabase URL points to localhost or 127.0.0.1
 */
export function isLocalDevelopment(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return false;
  }

  try {
    const url = new URL(supabaseUrl);
    const hostname = url.hostname.toLowerCase();

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') || // Local network
      hostname.endsWith('.local') // mDNS
    );
  } catch {
    // If URL parsing fails, assume production
    return false;
  }
}

/**
 * Select the appropriate image URL for external API calls
 * - Local development: Use temporary FAL URL (publicly accessible)
 * - Production: Generate signed URL from R2 storage path
 *
 * @param sourceImageUrl - Temporary FAL URL from image generation
 * @param storagePathOrUrl - R2 storage path or legacy storage URL
 * @returns The URL that should be used for external API calls (may be async in production)
 */
export async function getImageUrlForApi(
  sourceImageUrl: string | undefined | null,
  storagePathOrUrl: string | undefined | null
): Promise<string | null> {
  if (isLocalDevelopment()) {
    // In local dev, prefer temporary FAL URL (publicly accessible)
    return sourceImageUrl || storagePathOrUrl || null;
  }

  // In production, check if we have a storage path (not a URL)
  if (storagePathOrUrl && !storagePathOrUrl.startsWith('http')) {
    // It's a storage path - generate a signed URL
    const { getSignedImageUrl } = await import('@/lib/image/image-storage');
    return await getSignedImageUrl(storagePathOrUrl, 7200); // 2 hour expiry
  }

  return storagePathOrUrl || sourceImageUrl || null;
}
