/**
 * Environment utility functions for checking feature availability
 * based on environment variables and deployment context.
 */

/**
 * Get the application URL with platform-specific fallbacks
 * Priority: APP_URL → RAILWAY_PUBLIC_DOMAIN → VERCEL_URL → localhost
 */
function getAppUrl(): string {
  // Explicit APP_URL (should be set in Railway/Vercel production)
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // Railway deployment - use public domain
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  // Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development default
  return 'http://localhost:3000';
}

/**
 * Server-side application URL
 * Used by Better Auth, QStash webhooks, and internal API calls
 */
export const APP_URL = getAppUrl();

/**
 * Client-side application URL
 * Falls back to window.location.origin in browser for dynamic detection
 */
export const NEXT_PUBLIC_APP_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || APP_URL;

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
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    return false;
  }

  try {
    const url = new URL(appUrl);
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
