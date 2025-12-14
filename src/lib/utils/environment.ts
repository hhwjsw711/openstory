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
type DeploymentPlatform =
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
 * Server-side application URL
 * Used by Better Auth, QStash webhooks, and internal API calls
 * Lazily evaluated to support Cloudflare Workers
 */
export function getServerAppUrl(request: Request): string {
  const url = new URL(request.url);
  return url.origin;
}

/**
 * Get production deployment app URL
 * Used for OAuth redirects on preview branches
 */
export function getProductionDeploymentAppUrl(request: Request): string {
  const appUrl = getServerAppUrl(request);

  if (
    appUrl === 'https://app.velro.ai' ||
    appUrl === 'https://r.velro.ai' ||
    appUrl === 'https://v.velro.ai' ||
    appUrl === 'https://cf.velro.ai'
  ) {
    return appUrl;
  }
  if (/https:\/\/.*\.velro.ai/.test(appUrl)) {
    return 'https://app.velro.ai';
  }
  if (/https:\/\/.*\.velro.workers.dev/.test(appUrl)) {
    return 'https://cf.velro.ai';
  }
  if (/https:\/\/velro.*\.vercel.app/.test(appUrl)) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (/https:\/\/.*\.railway.app/.test(appUrl)) {
    return 'https://velro.up.railway.app';
  }

  return appUrl;
}

export function isProductionDeployment(request: Request): boolean {
  return (
    !isLocalDevelopment() &&
    getProductionDeploymentAppUrl(request) === getServerAppUrl(request)
  );
}

function isPreviewDeployment(request: Request): boolean {
  return !isLocalDevelopment() && !isProductionDeployment(request);
}

/**
 * Check if we're running in local development environment
 */
export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
