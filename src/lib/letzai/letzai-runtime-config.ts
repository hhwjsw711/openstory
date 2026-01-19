import type { CreateClientConfig } from '@/lib/letzai/sdk/client.gen';

/**
 * Safely extract headers object from config.
 * Handles Headers instance, arrays, and plain objects.
 */
function getHeadersObject(
  headers: unknown
): Record<string, string> | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  if (Array.isArray(headers)) {
    const obj: Record<string, string> = {};
    for (const [key, value] of headers) {
      if (typeof key === 'string' && typeof value === 'string') {
        obj[key] = value;
      }
    }
    return obj;
  }
  if (typeof headers === 'object' && headers !== null) {
    // Convert object entries to ensure proper Record<string, string> type
    const obj: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        obj[key] = value;
      }
    }
    return obj;
  }
  return undefined;
}

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  headers: {
    Authorization: `Bearer ${process.env.LETZAI_API_KEY}`,
    'Content-Type': 'application/json',
    ...getHeadersObject(config?.headers),
  },
});
