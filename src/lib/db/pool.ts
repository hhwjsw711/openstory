import postgres from 'postgres';

const conn = process.env.POSTGRES_URL;
if (!conn) {
  throw new Error('POSTGRES_URL environment variable is required');
}

const isLocalDevelopment =
  conn.includes('localhost') || conn.includes('127.0.0.1');

export const sql = postgres(conn, {
  // Serverless-optimized settings
  max: isLocalDevelopment ? 10 : 1, // Only 1 connection per serverless instance
  idle_timeout: 20, // Close idle connections after 20s (in seconds for postgres.js)
  connect_timeout: 10, // Timeout if connection takes >10s (in seconds)
  max_lifetime: 60 * 30, // Recycle connection after 30 minutes
  prepare: false, // Required for pgbouncer transaction mode
  // SSL configuration
  ssl: isLocalDevelopment ? false : 'require', // 'require' mode accepts self-signed certs
});
