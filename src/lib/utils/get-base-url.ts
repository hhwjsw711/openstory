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
