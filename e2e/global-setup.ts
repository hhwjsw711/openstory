import { execFileSync } from 'node:child_process';

/**
 * Playwright global setup - ensures test.db is migrated and seeded before tests run.
 */
export default function globalSetup() {
  console.log('[e2e] Migrating test database...');
  execFileSync(
    'bun',
    ['--bun', 'drizzle-kit', 'migrate', '--config=drizzle.config.test.ts'],
    { stdio: 'inherit' }
  );

  console.log('[e2e] Seeding test database...');
  execFileSync('bun', ['--bun', 'scripts/seed.ts', '--test'], {
    stdio: 'inherit',
  });
}
