import { APP_URL } from './environment';

/**
 * Get the URL for QStash webhooks
 * In production, QStash needs a publicly accessible URL
 * In local development, we use a local QStash server that can reach localhost
 */
export function getQStashWebhookUrl(): string {
  // Use centralized APP_URL, but convert localhost to host.docker.internal
  // for QStash running in Docker to reach the Next.js app
  if (APP_URL.includes('localhost') || APP_URL.includes('127.0.0.1')) {
    const appUrl = new URL(APP_URL);
    return `http://host.docker.internal${appUrl.port ? `:${appUrl.port}` : ''}`;
  }

  return APP_URL;
}

/**
 * Get the internal app URL for server-to-server calls within the same app
 * Used when API routes need to call other API routes or workflows
 */
export function getInternalAppUrl(): string {
  // Use centralized APP_URL directly
  // Works for both localhost (Next.js calling itself) and production
  return APP_URL;
}
