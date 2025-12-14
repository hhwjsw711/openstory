/**
 * Prompt versioning utilities
 * Generate version hashes for system and user prompts to track which prompt versions were used
 * TB: This is used by the prompt audit trail
 */

/**
 * Cache for computed hashes to avoid repeated calculations
 */
const hashCache = new Map<string, string>();

/**
 * Generate a SHA-256 hash and return first 8 characters
 * Uses Web Crypto API available in both Node.js and browsers
 */
async function generateHash(content: string, length: number): Promise<string> {
  const cacheKey = `${content.substring(0, 100)}-${length}`;

  const cachedHash = hashCache.get(cacheKey);
  if (cachedHash) {
    return cachedHash;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const shortHash = hashHex.substring(0, length);

  hashCache.set(cacheKey, shortHash);
  return shortHash;
}

/**
 * Get version identifier for the system prompt
 * Returns first 8 characters of SHA-256 hash
 *
 * @param systemPrompt - The system prompt text
 * @returns Short hash representing this version of the system prompt
 */
export async function getSystemPromptVersion(
  systemPrompt: string
): Promise<string> {
  return generateHash(systemPrompt, 8);
}

/**
 * Clear the hash cache
 * Useful for testing or if memory usage becomes a concern
 */
export function clearHashCache(): void {
  hashCache.clear();
}
