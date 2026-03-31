/**
 * Drizzle Database Client
 * Centralized database client using libSQL (Turso)
 */

import { getEnv } from '#env';
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import { relations } from './schema/relations';

console.log('[db-http] Loading client');

type Database = ReturnType<
  typeof drizzle<Record<string, never>, typeof relations>
>;

let _db: Database | undefined;

export const getDb = (): Database => {
  if (_db) return _db;

  const tursoUrl = getEnv().TURSO_DATABASE_URL;
  const tursoToken = getEnv().TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    throw new Error('TURSO_DATABASE_URL is required');
  }

  const client = createClient({
    url: tursoUrl,
    ...(tursoToken && { authToken: tursoToken }),
  });

  _db = drizzle({
    client,
    relations,
    logger: getEnv().NODE_ENV === 'development',
    casing: 'snake_case',
  });

  return _db;
};
