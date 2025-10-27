import pg from 'pg';

const { Pool } = pg;

const conn = process.env.POSTGRES_URL;
if (!conn) {
  throw new Error('POSTGRES_URL environment variable is required');
}

const dbUrl = new URL(conn);
dbUrl.searchParams.set('sslmode', 'no-verify');

export const pgPool = new Pool({
  connectionString: dbUrl.toString(),
  ssl: { rejectUnauthorized: false },
});
