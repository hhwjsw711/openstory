import { getEnv } from '#env';
import { createClient, type Client as LibsqlClient } from '@libsql/client/web';
import { drizzle } from 'drizzle-orm/libsql';
import { relations } from './schema/relations';

console.log('[db-web] Loading client');

type Database = ReturnType<
  typeof drizzle<Record<string, never>, typeof relations>
>;

let _db: Database | undefined;

function buildLibsqlClient(): LibsqlClient {
  const env = getEnv();
  const url = env.TURSO_DATABASE_URL?.trim();
  if (url === undefined) {
    throw new Error('TURSO_DATABASE_URL env var is not defined');
  }

  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (authToken == undefined) {
    throw new Error('TURSO_AUTH_TOKEN env var is not defined');
  }

  return createClient({ url, authToken });
}

export const getDb = (): Database => {
  if (_db) return _db;

  const client = buildLibsqlClient();

  _db = drizzle({
    client,
    relations,
    logger: getEnv().NODE_ENV === 'development',
    casing: 'snake_case',
  });

  return _db;
};
