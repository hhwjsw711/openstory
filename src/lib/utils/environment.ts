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
 * Server-side application URL
 * Used by Better Auth, QStash webhooks, and internal API calls
 * Lazily evaluated to support Cloudflare Workers
 */
let _appUrl: string | undefined;
export function getServerAppUrl(request: Request): string {
  const url = new URL(request.url);
  return url.origin;
}

/**
 * Get production deployment app URL
 * Used for OAuth redirects on preview branches
 */
let _productionAppUrl: string | undefined;
export function getProductionDeploymentAppUrl(request: Request): string {
  if (_productionAppUrl) return _productionAppUrl;

  const appUrl = getServerAppUrl(request);

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

export function isProductionDeployment(request: Request): boolean {
  return (
    !isLocalDevelopment() &&
    getProductionDeploymentAppUrl(request) === getServerAppUrl(request)
  );
}

export function isPreviewDeployment(request: Request): boolean {
  return !isLocalDevelopment() && !isProductionDeployment(request);
}

/**
 * Check if we're running in local development environment
 */
export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
