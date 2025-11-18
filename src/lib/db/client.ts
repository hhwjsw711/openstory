/**
 * Drizzle Database Client
 * Centralized database client using libSQL (Turso)
 *
 * Automatically selects the appropriate client based on URL scheme:
 * - file: URLs → @libsql/client (supports local SQLite files)
 * - Other URLs (libsql:, https:, etc.) → @libsql/client/web (works everywhere including Cloudflare Workers)
 */

import { drizzle } from 'drizzle-orm/libsql';
import { schema } from './schema';

// Import both clients - bundler will tree-shake unused imports
import { createClient as createClientStandard } from '@libsql/client';
import { createClient as createClientWeb } from '@libsql/client/web';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl) {
  throw new Error('TURSO_DATABASE_URL is required');
}

// TypeScript: tursoUrl is guaranteed to be defined after the check above
const databaseUrl: string = tursoUrl;

/**
 * Create libSQL client with URL-appropriate implementation
 * - file: URLs: use standard client (supports local SQLite files)
 * - Other URLs (libsql:, https:, etc.): use web client (works everywhere including Cloudflare Workers)
 */
function createLibsqlClient() {
  // Use web client for all non-file URLs (works in Cloudflare Workers and other platforms)
  // Use standard client only for file: URLs (local development)
  const isFileUrl = databaseUrl.startsWith('file:');
  const createClient = isFileUrl ? createClientStandard : createClientWeb;

  return createClient({
    url: databaseUrl,
    ...(tursoToken && { authToken: tursoToken }),
  });
}

/**
 * libSQL client instance
 * Connects to Turso database (cloud) or local SQLite file
 * - For local development: use file: URLs (e.g., file:local.db)
 * - For production: use libsql:// or https:// URLs with auth token
 */
const client = createLibsqlClient();

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
