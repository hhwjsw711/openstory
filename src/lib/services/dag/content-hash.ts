/**
 * Content Hash Utility
 * Deterministic SHA-256 hashing for entity data.
 * Uses sorted keys for consistent hashing regardless of property insertion order.
 */

/** Sort object keys recursively for deterministic JSON serialization. */
function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowed by typeof+null check
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return value;
}

/** SHA-256 hex digest of an arbitrary string. */
async function sha256(input: string): Promise<string> {
  const buffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 content hash of entity data.
 * Uses sorted keys for deterministic hashing — identical data always produces identical hash.
 */
export async function computeContentHash(data: unknown): Promise<string> {
  return sha256(JSON.stringify(sortKeys(data)));
}

/**
 * Compute input hash from a set of dependency content hashes.
 * Sorts hashes alphabetically and hashes the concatenation.
 * Does NOT mutate the input array.
 */
export async function computeInputHash(depHashes: string[]): Promise<string> {
  return sha256([...depHashes].sort().join(''));
}
