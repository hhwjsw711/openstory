/**
 * Drizzle Database Client
 * Centralized database client using libSQL (Turso)
 */

import { createClient } from '@libsql/client/http';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { schema } from './schema';
// @ts-ignore - resolved via package.json imports
import { env } from '#env';

// Define the database type explicitly
type Database = LibSQLDatabase<typeof schema>;

let _db: Database | undefined;

const getDb = (): Database => {
  if (_db) return _db;

  const tursoUrl = env.TURSO_DATABASE_URL;
  const tursoToken = env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    throw new Error('TURSO_DATABASE_URL is required');
  }

  /**
   * libSQL client instance
   * Connects to Turso database (cloud) or local SQLite file
   * - For local development: use file: URLs (e.g., file:local.db)
   * - For production: use https:// URLs with auth token
   */
  const client = createClient({
    url: tursoUrl,
    ...(tursoToken && { authToken: tursoToken }), // Only include if defined
  });

  /**
   * Drizzle database instance
   * Uses the libSQL client and includes all schema definitions
   * Configured to use snake_case in database and camelCase in application
   */
  _db = drizzle(client, {
    schema,
    logger: env.NODE_ENV === 'development',
    casing: 'snake_case',
  });

  return _db;
};

/**
 * Drizzle database instance
 * Uses the libSQL client and includes all schema definitions
 * Configured to use snake_case in database and camelCase in application
 *
 * Wrapped in a Proxy to support lazy initialization for Cloudflare Workers
 * where environment variables are only available during request handling.
 */
export const db = new Proxy({} as Database, {
  get(target, prop) {
    const instance = getDb();
    return Reflect.get(instance, prop);
  },
});
