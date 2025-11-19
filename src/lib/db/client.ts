/**
 * Drizzle Database Client
 * Centralized database client using libSQL (Turso)
 *
 * Automatically selects the appropriate client based on URL scheme:
 * - file: URLs → @libsql/client (supports local SQLite files)
 * - Other URLs (libsql:, https:, etc.) → @libsql/client/web (works everywhere including Cloudflare Workers)
 *
 * Uses dynamic imports to prevent bundling Node.js-specific dependencies in Cloudflare Workers builds.
 */

import { drizzle } from 'drizzle-orm/libsql';
import { schema } from './schema';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl) {
  throw new Error('TURSO_DATABASE_URL is required');
}

// TypeScript: tursoUrl is guaranteed to be defined after the check above
const databaseUrl: string = tursoUrl;

/**
 * Create libSQL client with URL-appropriate implementation using dynamic imports
 * - file: URLs: use standard client (supports local SQLite files)
 * - Other URLs (libsql:, https:, etc.): use web client (works everywhere including Cloudflare Workers)
 *
 * Uses dynamic imports to prevent bundling Node.js-specific dependencies when building for Cloudflare.
 */
async function createLibsqlClient() {
  const isFileUrl = databaseUrl.startsWith('file:');

  if (isFileUrl) {
    // Dynamic import for standard client (only loaded for file: URLs)
    // This prevents bundling Node.js dependencies in Cloudflare Workers builds
    const { createClient } = await import('@libsql/client');
    return createClient({
      url: databaseUrl,
      ...(tursoToken && { authToken: tursoToken }),
    });
  } else {
    // Dynamic import for web client (works everywhere including Cloudflare Workers)
    const { createClient } = await import('@libsql/client/web');
    return createClient({
      url: databaseUrl,
      ...(tursoToken && { authToken: tursoToken }),
    });
  }
}

/**
 * libSQL client instance
 * Uses top-level await to initialize the client asynchronously.
 * This allows dynamic imports to prevent bundling Node.js-specific dependencies
 * when building for Cloudflare Workers.
 *
 * Connects to Turso database (cloud) or local SQLite file:
 * - For local development: use file: URLs (e.g., file:local.db)
 * - For production: use libsql:// or https:// URLs with auth token
 */
const client = await createLibsqlClient();

/**
 * Drizzle database instance
 * Uses the libSQL client and includes all schema definitions
 * Configured to use snake_case in database and camelCase in application
 */
export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development',
  casing: 'snake_case',
});

/**
 * Type alias for the database instance
 * Use this type when passing the db instance as a parameter
 */
export type Database = typeof db;
