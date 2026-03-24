/**
 * Drizzle Database Client
 * Centralized database client using libSQL (Turso)
 */

import { createClient } from '@libsql/client';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { schema } from './schema';

console.log('[db-local] Loading client');

type Database = LibSQLDatabase<typeof schema>;

const dbUrl = process.env.DATABASE_URL || 'file:local.db';
const client = createClient({ url: dbUrl });

// Set busy_timeout so concurrent queries wait for locks instead of failing with SQLITE_BUSY
client.execute('PRAGMA busy_timeout = 5000').catch(() => {
  // Ignore errors (e.g. remote Turso connections don't support PRAGMAs)
});

/**
 * Drizzle database instance
 * Uses the libSQL client and includes all schema definitions
 * Configured to use snake_case in database and camelCase in application
 */
const _db: Database = drizzle(client, {
  schema,
  logger: false,
  casing: 'snake_case',
});

export const getDb = (): Database => _db;
