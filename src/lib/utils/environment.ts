/**
 * Environment utility functions for checking feature availability
 * based on environment variables and deployment context.
 *
 * IMPORTANT: All functions use lazy evaluation to support Cloudflare Workers
 * where process.env is only populated at request time.
 */

import { getEnv } from '#env';

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
  const env = getEnv();
  if (env.CF_PAGES) {
    return 'cloudflare';
  }
  if (env.VERCEL) {
    return 'vercel';
  }
  if (env.RAILWAY_ENVIRONMENT) {
    return 'railway';
  }
  if (env.NODE_ENV === 'development') {
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
 * Used for OAuth redirects on preview branches.
 * If APP_URL env var is set, use that as the canonical production URL.
 * Otherwise fall back to the request origin.
 */
export function getProductionDeploymentAppUrl(request: Request): string {
  const envAppUrl = getEnv().APP_URL;
  if (envAppUrl) {
    return envAppUrl.replace(/\/$/, '');
  }

  return getServerAppUrl(request);
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
 * Check if a hostname is a preview deployment
 * Pure function that can be used on server or client.
 * If APP_URL env var is set, a preview host is any host that doesn't match it.
 * If no APP_URL, consider it non-preview.
 */
export function isPreviewHost(host: string): boolean {
  if (host.startsWith('localhost')) {
    return false;
  }

  const envAppUrl = getEnv().APP_URL;
  if (!envAppUrl) {
    return false;
  }

  try {
    const productionHost = new URL(envAppUrl).host;
    return host !== productionHost;
  } catch {
    return false;
  }
}

/**
 * Check if we're running in local development environment
 */
export function isLocalDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}
