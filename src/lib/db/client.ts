/**
 * Drizzle Database Client
 * Centralized database client using postgres.js
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from './pool';
import { schema } from './schema';

/**
 * Drizzle database instance
 * Uses the postgres.js client and includes all schema definitions
 * Configured to use snake_case in database and camelCase in application
 */
export const db = drizzle(sql, {
  schema,
  logger: process.env.NODE_ENV === 'development',
  casing: 'snake_case',
});

/**
 * Type alias for the database instance
 * Use this type when passing the db instance as a parameter
 */
export type Database = typeof db;
