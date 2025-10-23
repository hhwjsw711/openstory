/**
 * Drizzle Database Client
 * Centralized database client using the shared PostgreSQL pool
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { pgPool } from './pool';
import { schema } from './schema';

/**
 * Drizzle database instance
 * Uses the shared pgPool connection and includes all schema definitions
 * Configured to use snake_case in database and camelCase in application
 */
export const db = drizzle(pgPool, {
  schema,
  logger: process.env.NODE_ENV === 'development',
  casing: 'snake_case',
});

/**
 * Type alias for the database instance
 * Use this type when passing the db instance as a parameter
 */
export type Database = typeof db;
