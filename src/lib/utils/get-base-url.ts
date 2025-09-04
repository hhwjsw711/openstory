/**
 * Get the base URL for the application
 * Works in both server and client environments
 */
export function getBaseUrl(): string {
  // Browser should use relative URL
  if (typeof window !== "undefined") {
    return "";
  }

  // Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development with QStash tunnel
  if (process.env.QSTASH_TUNNEL_URL) {
    return process.env.QSTASH_TUNNEL_URL;
  }

  // Fallback to APP_URL if set (for backwards compatibility)
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // Default to localhost
  return "http://localhost:3000";
}

/**
 * Get the absolute URL for the application
 * Useful for external services that need the full URL
 */
export function getAbsoluteUrl(): string {
  const baseUrl = getBaseUrl();

  // If we got an empty string (client-side), construct from window.location
  if (baseUrl === "" && typeof window !== "undefined") {
    return window.location.origin;
  }

  return baseUrl;
}

/**
 * Get the URL for QStash webhooks
 * QStash requires a publicly accessible URL
 */
export function getQStashWebhookUrl(): string {
  // In production (Vercel deployment)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development with QStash tunnel (from bun qstash:dev)
  if (process.env.QSTASH_TUNNEL_URL) {
    return process.env.QSTASH_TUNNEL_URL;
  }

  // Fallback to APP_URL if explicitly set
  if (process.env.APP_URL && process.env.APP_URL !== "http://localhost:3000") {
    return process.env.APP_URL;
  }

  // In local development without tunnel, QStash webhooks won't work
  console.warn(
    "[QStash] No public URL available for webhooks. Run 'bun qstash:dev' to set up a tunnel for local development.",
  );
  return "http://localhost:3000";
}
