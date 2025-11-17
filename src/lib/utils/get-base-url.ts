/**
 * Get the URL for QStash webhooks
 * In production, QStash needs a publicly accessible URL
 * In local development, we use a local QStash server that can reach localhost
 */
export function getQStashWebhookUrl(): string {
  // Explicit BASE_URL or APP_URL (should be set in Railway/Vercel)
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // Railway deployment - use public domain
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  // Railway environment variable (alternative)
  if (process.env.RAILWAY_STATIC_URL) {
    return process.env.RAILWAY_STATIC_URL;
  }

  // Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development with QStash tunnel (if using cloud QStash)
  if (process.env.QSTASH_TUNNEL_URL) {
    return process.env.QSTASH_TUNNEL_URL;
  }

  // Local development with local QStash server (default)
  // The local QStash server now runs on docker. This is the correct URL to use for the QStash webhook.
  return 'http://host.docker.internal:3000';
}

/**
 * Get the internal app URL for server-to-server calls within the same app
 * Used when API routes need to call other API routes or workflows
 */
export function getInternalAppUrl(): string {
  // Explicit BASE_URL or APP_URL (should be set in Railway/Vercel)
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // Railway deployment - use public domain
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  // Railway environment variable (alternative)
  if (process.env.RAILWAY_STATIC_URL) {
    return process.env.RAILWAY_STATIC_URL;
  }

  // Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development default - use localhost, not host.docker.internal
  // This works from the Next.js process calling itself
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}
