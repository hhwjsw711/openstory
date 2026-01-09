#!/usr/bin/env bun
/**
 * Pre-migration safety check script
 *
 * Scans migration files for destructive operations (DROP TABLE, TRUNCATE, etc.)
 * and requires explicit confirmation before allowing migrations to proceed.
 *
 * Usage:
 *   bun scripts/check-migrations.ts                    # Check and warn
 *   bun scripts/check-migrations.ts --allow-destructive  # Bypass warning
 *
 * Exit codes:
 *   0 - Safe to proceed (no destructive operations or --allow-destructive flag)
 *   1 - Destructive operations found, user should review
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const MIGRATIONS_DIR = join(import.meta.dir, '../drizzle/migrations');
const JOURNAL_PATH = join(MIGRATIONS_DIR, 'meta/_journal.json');

type DestructiveOperation = {
  file: string;
  line: number;
  operation: string;
  statement: string;
  isSafeRecreation: boolean;
};

type Journal = {
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
};

// Patterns that indicate destructive operations
const DESTRUCTIVE_PATTERNS = [
  {
    pattern: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`?([^`\s;]+)`?/gi,
    name: 'DROP TABLE',
  },
  { pattern: /TRUNCATE\s+(?:TABLE\s+)?`?([^`\s;]+)`?/gi, name: 'TRUNCATE' },
  { pattern: /DELETE\s+FROM\s+`?([^`\s;]+)`?\s*(?:;|$)/gi, name: 'DELETE ALL' },
  {
    pattern: /ALTER\s+TABLE\s+`?([^`\s;]+)`?\s+DROP\s+COLUMN/gi,
    name: 'DROP COLUMN',
  },
];

// Pattern for SQLite safe table recreation (not actually destructive)
const SAFE_RECREATION_PATTERN =
  /DROP\s+TABLE\s+`?([^`\s;]+)`?.*?ALTER\s+TABLE\s+`?__new_\1`?\s+RENAME/gis;

function getAppliedMigrations(): Set<string> {
  if (!existsSync(JOURNAL_PATH)) {
    return new Set();
  }

  const journal: Journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf-8'));
  return new Set(journal.entries.map((e) => `${e.tag}.sql`));
}

function getPendingMigrations(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  const applied = getAppliedMigrations();
  const allFiles = readdirSync(MIGRATIONS_DIR).filter((f) =>
    f.endsWith('.sql')
  );

  // Return all migrations if journal is empty (fresh db), otherwise only pending
  if (applied.size === 0) {
    return allFiles;
  }

  return allFiles.filter((f) => !applied.has(f));
}

function findDestructiveOperations(filePath: string): DestructiveOperation[] {
  const content = readFileSync(filePath, 'utf-8');
  const fileName = basename(filePath);
  const operations: DestructiveOperation[] = [];

  // Check for safe SQLite table recreation pattern
  const safeRecreations = new Set<string>();
  let match: RegExpExecArray | null;

  // Reset regex
  SAFE_RECREATION_PATTERN.lastIndex = 0;
  while ((match = SAFE_RECREATION_PATTERN.exec(content)) !== null) {
    safeRecreations.add(match[1].toLowerCase());
  }

  // Find all destructive operations
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { pattern, name } of DESTRUCTIVE_PATTERNS) {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(line)) !== null) {
        const tableName = match[1].toLowerCase();
        const isSafeRecreation =
          safeRecreations.has(tableName) || tableName.startsWith('__new_');

        operations.push({
          file: fileName,
          line: i + 1,
          operation: name,
          statement:
            line.trim().substring(0, 80) + (line.length > 80 ? '…' : ''),
          isSafeRecreation,
        });
      }
    }
  }

  return operations;
}

function main(): void {
  const args = process.argv.slice(2);
  const allowDestructive = args.includes('--allow-destructive');
  const checkAll = args.includes('--all');

  console.log('🔍 Checking migrations for destructive operations…\n');

  const migrations = checkAll
    ? readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
    : getPendingMigrations();

  if (migrations.length === 0) {
    console.log('✅ No pending migrations to check.\n');
    process.exit(0);
  }

  console.log(
    `Checking ${migrations.length} ${checkAll ? 'total' : 'pending'} migration(s):\n`
  );

  const allOperations: DestructiveOperation[] = [];

  for (const migration of migrations) {
    const filePath = join(MIGRATIONS_DIR, migration);
    const operations = findDestructiveOperations(filePath);
    allOperations.push(...operations);
  }

  // Separate truly destructive from safe recreations
  const dangerous = allOperations.filter((op) => !op.isSafeRecreation);
  const safeRecreations = allOperations.filter((op) => op.isSafeRecreation);

  if (safeRecreations.length > 0) {
    console.log('ℹ️  Safe table recreations (SQLite pattern):');
    for (const op of safeRecreations) {
      console.log(`   ${op.file}:${op.line} - ${op.operation}`);
    }
    console.log('');
  }

  if (dangerous.length === 0) {
    console.log('✅ No destructive operations found. Safe to proceed.\n');
    process.exit(0);
  }

  // Found destructive operations
  console.log('⚠️  DESTRUCTIVE OPERATIONS DETECTED:\n');

  for (const op of dangerous) {
    console.log(`   📁 ${op.file}:${op.line}`);
    console.log(`   ❌ ${op.operation}`);
    console.log(`      ${op.statement}`);
    console.log('');
  }

  console.log('─'.repeat(60));
  console.log('');
  console.log('These operations may cause DATA LOSS:');
  console.log('');

  const tables = [
    ...new Set(
      dangerous.map((op) => op.statement.match(/`([^`]+)`/)?.[1] || 'unknown')
    ),
  ];
  for (const table of tables) {
    console.log(`  • Table "${table}" may be dropped or truncated`);
  }

  console.log('');

  if (allowDestructive) {
    console.log('⚡ --allow-destructive flag set. Proceeding anyway.\n');
    process.exit(0);
  }

  console.log('To proceed with these migrations, either:');
  console.log('');
  console.log('  1. Review and fix the migration files, then regenerate');
  console.log(
    '  2. Run with --allow-destructive flag if data loss is intentional:'
  );
  console.log('');
  console.log('     bun db:migrate:local --allow-destructive');
  console.log('');

  process.exit(1);
}

main();
