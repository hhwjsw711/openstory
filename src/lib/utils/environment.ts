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
  return !!process.env.OPEN_NEXT_ORIGIN;
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

  if (process.env.OPEN_NEXT_ORIGIN) {
    // running in Open Next
    const openNextOrigin = JSON.parse(process.env.OPEN_NEXT_ORIGIN);
    const defaultOrigin = openNextOrigin.default;
    return `${defaultOrigin.protocol}://${defaultOrigin.host}${defaultOrigin.port ? `:${defaultOrigin.port}` : ''}`;
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
 * This returns the app URL for production deployments
 * This is used in the redirect URIs for OAuth providers on preview branches
 */
export function getProductionDeploymentAppUrl(): string {
  if (/https:\/\/.*\.velro.ai/.test(APP_URL)) {
    return 'https://app.velro.ai';
  }
  if (/https:\/\/.*\.velro.workers.dev/.test(APP_URL)) {
    return 'https://frontend-prd.velro.workers.dev';
  }
  if (/https:\/\/velro.*\.vercel.app/.test(APP_URL)) {
    return 'https://velro-phi.vercel.app'; // staging deployment
  }
  if (/https:\/\/.*\.railway.app/.test(APP_URL)) {
    return 'https://velro.up.railway.app'; // production deployment
  }

  // Otherwise, return the original app URL
  return APP_URL;
}

export const PRODUCTION_DEPLOYMENT_APP_URL = getProductionDeploymentAppUrl();

export function isProductionDeployment(): boolean {
  return PRODUCTION_DEPLOYMENT_APP_URL === APP_URL;
}

export function isPreviewDeployment(): boolean {
  return !isLocalDevelopment() && !isProductionDeployment();
}

/**
 * Check if we're running in local development environment
 * Detected by checking if Supabase URL points to localhost or 127.0.0.1
 */
export function isLocalDevelopment(): boolean {
  const appUrl = NEXT_PUBLIC_APP_URL;

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
