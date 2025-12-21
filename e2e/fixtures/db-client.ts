/**
 * Test Database Client for E2E Tests
 * Drizzle ORM instance pointing to test.db
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { schema } from '@/lib/db/schema';

const client = createClient({ url: 'file:test.db' });

/**
 * Drizzle database instance for e2e tests
 * Uses test.db (same as e2e dev server)
 * Configured with same schema/casing as production
 */
export const testDb = drizzle(client, {
  schema,
  casing: 'snake_case',
});

/**
 * Get the raw libSQL client for operations that need it
 * (e.g., PRAGMA commands, dynamic table operations)
 */
export const getTestClient = () => client;
