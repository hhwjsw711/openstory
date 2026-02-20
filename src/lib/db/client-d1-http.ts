/**
 * Drizzle Database Client - Cloudflare D1 via HTTP API
 * Used by CI scripts (seed, etc.) that run outside Cloudflare Workers.
 * Same pattern drizzle-kit uses internally for d1-http migrations.
 */

import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { schema } from './schema';

export function createD1HttpClient(opts: {
  accountId: string;
  databaseId: string;
  token: string;
}) {
  const remoteCallback = async (
    sql: string,
    params: unknown[],
    method: 'run' | 'all' | 'values' | 'get'
  ) => {
    const endpoint = method === 'values' ? 'raw' : 'query';
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/d1/database/${opts.databaseId}/${endpoint}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
      }
    );
    const data: {
      success: boolean;
      errors: Array<{ code: number; message: string }>;
      result: Array<{ results: unknown[] }>;
    } = await res.json();
    if (!data.success) {
      throw new Error(
        data.errors.map((e) => `${e.code}: ${e.message}`).join('\n')
      );
    }
    const result = data.result[0].results;
    return { rows: Array.isArray(result) ? result : [] };
  };

  return drizzle(remoteCallback, { schema, casing: 'snake_case' });
}
