/**
 * Drizzle Database Client
 * Centralized database client with platform-specific drivers.
 *
 * Automatically selects the appropriate driver based on build environment via package.json imports:
 * - workerd:      Uses Cloudflare D1 (native serverless SQLite on Cloudflare)
 * - development:  Uses Bun's native sqlite (local development)
 * - default:      Uses libSQL web client (Turso - production fallback for non-Cloudflare platforms)
 *
 * This approach:
 * - Uses conditional exports in package.json to swap implementations at build time
 * - Completely excludes platform-specific code from other builds
 * - Cloudflare deployments use D1 natively; other platforms use Turso
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
