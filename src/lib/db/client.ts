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
import { db } from '#db-client';
export { db } from '#db-client';

/**
 * Type alias for the database instance
 * Use this type when passing the db instance as a parameter
 */
export type Database = typeof db;
