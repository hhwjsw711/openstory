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
