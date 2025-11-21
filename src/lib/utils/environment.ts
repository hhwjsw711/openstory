/**
 * Environment utility functions for checking feature availability
 * based on environment variables and deployment context.
 */

/**
 * Platform detection
 */
export type DeploymentPlatform =
  | 'cloudflare'
  | 'vercel'
  | 'railway'
  | 'local'
  | 'unknown';

/**
 * Detect which platform the app is running on
 */
export function getDeploymentPlatform(): DeploymentPlatform {
  // Note this should use process.env at build time, not getEnv()
  if (process.env.CF_PAGES) {
    return 'cloudflare';
  }
  if (process.env.VERCEL) {
    return 'vercel';
  }
  if (process.env.RAILWAY_ENVIRONMENT) {
    return 'railway';
  }
  if (process.env.NODE_ENV === 'development') {
    return 'local';
  }
  return 'unknown';
}

/**
 * Check if running on Cloudflare Pages/Workers
 */
export function isCloudflare(): boolean {
  return process.env.CF_PAGES === '1' || !!process.env.CF_PAGES_URL;
}

/**
 * Get the application URL with platform-specific fallbacks
 * Priority: APP_URL → CF_PAGES_URL → RAILWAY_PUBLIC_DOMAIN → VERCEL_URL → localhost
 */
function getAppUrl(): string {
  // Cloudflare Pages deployment
  if (process.env.CF_PAGES_URL) {
    return process.env.CF_PAGES_URL;
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
export const APP_URL = process.env.APP_URL || getAppUrl();

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
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return isProduction || isDevelopment;
}

/**
 * Check if we're running in local development environment
 * Detected by checking if Supabase URL points to localhost or 127.0.0.1
 */
export function isLocalDevelopment(): boolean {
  const appUrl = APP_URL;

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
