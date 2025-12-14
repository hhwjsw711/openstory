/**
 * Drizzle Database Client
 * Centralized database client using libSQL (Turso) or Bun SQLite
 *
 * Automatically selects the appropriate driver based on build environment via package.json imports:
 * - development: Uses Bun's native sqlite (local development)
 * - default: Uses libSQL web client (production, works everywhere including Cloudflare Workers)
 *
 * This approach:
 * - Uses conditional exports in package.json to swap implementations at build time
 * - Completely excludes Bun-specific code from production builds
 * - Works on all platforms (Bun, Node.js, Cloudflare Workers, Vercel)
 */

import { getDb } from '#db-client';

/**
 * Drizzle database instance
 * Uses the libSQL client and includes all schema definitions
 * Configured to use snake_case in database and camelCase in application
 *
 * Wrapped in a Proxy to support lazy initialization for Cloudflare Workers
 * where environment variables are only available during request handling.
 */
// export const db = getDb();
/**
 * Type alias for the database instance
 * Use this type when passing the db instance as a parameter
 */
export type Database = ReturnType<typeof getDb>;
