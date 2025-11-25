/**
 * Drizzle Database Client
 * Centralized database client using libSQL (Turso)
 */

import { createClient } from '@libsql/client';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { schema } from './schema';

console.log('[db-local] Loading client');

type Database = LibSQLDatabase<typeof schema>;

const filePath = 'local.db';
const client = createClient({
  url: `file:${filePath}`,
});

/**
 * Drizzle database instance
 * Uses the libSQL client and includes all schema definitions
 * Configured to use snake_case in database and camelCase in application
 */
const _db: Database = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development',
  casing: 'snake_case',
});

export const getDb = (): Database => _db;
