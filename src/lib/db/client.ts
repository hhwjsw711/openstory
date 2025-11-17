/**
 * Drizzle Database Client
 * Centralized database client using libSQL (Turso)
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { schema } from './schema';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

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
