/**
 * Get the URL for QStash webhooks
 * In production, QStash needs a publicly accessible URL
 * In local development, we use a local QStash server that can reach localhost
 */
export function getQStashWebhookUrl(): string {
  // In production (Vercel deployment)
  if (process.env.VERCEL_URL) {
    const baseUrl = process.env.BASE_URL || `https://${process.env.VERCEL_URL}`;
    return baseUrl;
  }

  // Local development with QStash tunnel (if using cloud QStash)
  if (process.env.QSTASH_TUNNEL_URL) {
    return process.env.QSTASH_TUNNEL_URL;
  }

  // Fallback to APP_URL if explicitly set
  if (process.env.APP_URL) {
    return process.env.APP_URL;
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
  // In production (Vercel deployment)
  if (process.env.VERCEL_URL) {
    const baseUrl = process.env.BASE_URL || `https://${process.env.VERCEL_URL}`;
    return baseUrl;
  }

  // Local development with explicit APP_URL
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // Local development default - use localhost, not host.docker.internal
  // This works from the Next.js process calling itself
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}
