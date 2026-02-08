/**
 * Content Hash Utility
 * Deterministic SHA-256 hashing for entity data.
 * Uses sorted keys for consistent hashing regardless of property insertion order.
 */

/**
 * Sort object keys recursively for deterministic JSON serialization.
 * Handles nested objects, arrays, and primitive values.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys(value[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Compute SHA-256 content hash of entity data.
 * Uses sorted keys for deterministic hashing — identical data always produces identical hash.
 *
 * @param data - Entity data to hash
 * @returns Hex-encoded SHA-256 hash string
 */
export async function computeContentHash(data: unknown): Promise<string> {
  const sorted = sortKeys(data);
  const json = JSON.stringify(sorted);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(json);

  // Use Web Crypto API (available in Bun, Cloudflare Workers, and browsers)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute input hash from a set of dependency content hashes.
 * Sorts hashes alphabetically and hashes the concatenation.
 *
 * @param depHashes - Array of content hashes from dependencies
 * @returns Hex-encoded SHA-256 hash of combined dependency hashes
 */
export async function computeInputHash(depHashes: string[]): Promise<string> {
  const combined = depHashes.sort().join('');
  const encoder = new TextEncoder();
  const buffer = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
