/**
 * Environment utility functions for checking feature availability
 * based on environment variables and deployment context.
 *
 * IMPORTANT: All functions use lazy evaluation to support Cloudflare Workers
 * where process.env is only populated at request time.
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
 * Lazily evaluated to support Cloudflare Workers
 */
let _appUrl: string | undefined;
export function getServerAppUrl(): string {
  return (_appUrl ??= process.env.APP_URL || getAppUrl());
}

/**
 * Client-side application URL
 * Falls back to window.location.origin in browser
 */
let _clientAppUrl: string | undefined;
export function getClientAppUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return (_clientAppUrl ??=
    process.env.NEXT_PUBLIC_APP_URL || getServerAppUrl());
}

/**
 * @deprecated Use getServerAppUrl() instead for Cloudflare Workers compatibility
 */
export const APP_URL = getServerAppUrl();

/**
 * @deprecated Use getClientAppUrl() instead for Cloudflare Workers compatibility
 */
export const NEXT_PUBLIC_APP_URL = getClientAppUrl();

/**
 * Get production deployment app URL
 * Used for OAuth redirects on preview branches
 */
let _productionAppUrl: string | undefined;
export function getProductionDeploymentAppUrl(): string {
  if (_productionAppUrl) return _productionAppUrl;

  const appUrl = getServerAppUrl();

  if (
    appUrl === 'https://app.velro.ai' ||
    appUrl === 'https://r.velro.ai' ||
    appUrl === 'https://v.velro.ai' ||
    appUrl === 'https://cf.velro.ai'
  ) {
    _productionAppUrl = appUrl;
    return appUrl;
  }
  if (/https:\/\/.*\.velro.ai/.test(appUrl)) {
    _productionAppUrl = 'https://app.velro.ai';
    return _productionAppUrl;
  }
  if (/https:\/\/.*\.velro.workers.dev/.test(appUrl)) {
    _productionAppUrl = 'https://frontend-prd.velro.workers.dev';
    return _productionAppUrl;
  }
  if (/https:\/\/velro.*\.vercel.app/.test(appUrl)) {
    _productionAppUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    return _productionAppUrl;
  }
  if (/https:\/\/.*\.railway.app/.test(appUrl)) {
    _productionAppUrl = 'https://velro.up.railway.app';
    return _productionAppUrl;
  }

  _productionAppUrl = appUrl;
  return appUrl;
}

/**
 * @deprecated Use getProductionDeploymentAppUrl() instead
 */
export const PRODUCTION_DEPLOYMENT_APP_URL = getProductionDeploymentAppUrl();

export function isProductionDeployment(): boolean {
  return (
    !isLocalDevelopment() &&
    getProductionDeploymentAppUrl() === getServerAppUrl()
  );
}

export function isPreviewDeployment(): boolean {
  return !isLocalDevelopment() && !isProductionDeployment();
}

/**
 * Check if we're running in local development environment
 */
export function isLocalDevelopment(): boolean {
  const appUrl = getClientAppUrl();

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
