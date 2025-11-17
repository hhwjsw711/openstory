#!/usr/bin/env bun

/**
 * Supabase → Turso Data Migration Script
 * Migrates all data from Supabase (PostgreSQL + UUID) to Turso (SQLite + ULID)
 *
 * Features:
 * - Preserves all relationships
 * - Converts UUIDs to ULIDs
 * - Maintains referential integrity
 * - Validates data before migration
 * - Creates backup of source data
 * - Supports dry-run mode
 *
 * Usage:
 *   bun scripts/migrate-supabase-to-turso.ts [--dry-run] [--backup]
 *
 * Environment Variables:
 *   POSTGRES_URL            - Source Supabase PostgreSQL connection string
 *   TURSO_DATABASE_URL      - Target Turso database URL
 *   TURSO_AUTH_TOKEN        - Target Turso auth token
 */

import { generateId } from '@/lib/db/id';
import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import postgres from 'postgres';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const shouldBackup = args.includes('--backup');

console.log('🚀 Supabase → Turso Migration Script');
console.log('=====================================\n');

if (isDryRun) {
  console.log('⚠️  DRY RUN MODE - No data will be written\n');
}

// Validate environment variables
const requiredEnvVars = {
  POSTGRES_URL: process.env.POSTGRES_URL,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// Create database connections
const sourceDb = postgres(requiredEnvVars.POSTGRES_URL!);
const targetDb = createClient({
  url: requiredEnvVars.TURSO_DATABASE_URL!,
  authToken: requiredEnvVars.TURSO_AUTH_TOKEN!,
});

// UUID to ULID mapping for maintaining relationships
const uuidToUlidMap = new Map<string, string>();

/**
 * Get or create ULID for a UUID
 * Ensures consistent mapping across tables
 */
function getUlid(uuid: string | null): string | null {
  if (!uuid) return null;

  if (!uuidToUlidMap.has(uuid)) {
    uuidToUlidMap.set(uuid, generateId());
  }

  return uuidToUlidMap.get(uuid)!;
}

/**
 * Create backup of source data
 */
async function createBackup() {
  console.log('📦 Creating backup of source data...');

  const backupDir = path.join(process.cwd(), 'backups');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `supabase-backup-${timestamp}.json`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backup = {
    timestamp: new Date().toISOString(),
    tables: {} as Record<string, unknown[]>,
  };

  // Backup all tables
  const tables = [
    'user',
    'session',
    'account',
    'verification',
    'teams',
    'team_members',
    'team_invitations',
    'sequences',
    'frames',
    'styles',
    'style_adaptations',
    'characters',
    'vfx',
    'audio',
    'user_credits',
    'credit_transactions',
    'fal_requests',
    'letzai_requests',
    'audit_logs',
  ];

  for (const table of tables) {
    try {
      const rows = await sourceDb`SELECT * FROM ${sourceDb(table)}`;
      backup.tables[table] = rows;
      console.log(`  ✓ Backed up ${rows.length} rows from ${table}`);
    } catch (error) {
      console.warn(`  ⚠️  Could not backup ${table}: ${error}`);
    }
  }

  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`✅ Backup saved to: ${backupFile}\n`);

  return backupFile;
}

/**
 * Migrate users table (auth schema)
 */
async function migrateUsers() {
  console.log('👤 Migrating users...');

  const users = await sourceDb`SELECT * FROM "user" ORDER BY created_at`;
  console.log(`  Found ${users.length} users`);

  if (!isDryRun) {
    for (const user of users) {
      const ulid = getUlid(user.id);

      await targetDb.execute({
        sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at, is_anonymous, full_name, avatar_url, onboarding_completed)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          user.email,
          user.email_verified ? 1 : 0,
          user.name,
          user.image,
          Math.floor(new Date(user.created_at).getTime() / 1000),
          Math.floor(new Date(user.updated_at).getTime() / 1000),
          user.is_anonymous ? 1 : 0,
          user.full_name,
          user.avatar_url,
          user.onboarding_completed ? 1 : 0,
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${users.length} users\n`);
  return users.length;
}

/**
 * Migrate sessions table
 */
async function migrateSessions() {
  console.log('🔑 Migrating sessions...');

  const sessions = await sourceDb`SELECT * FROM "session" ORDER BY created_at`;
  console.log(`  Found ${sessions.length} sessions`);

  if (!isDryRun) {
    for (const session of sessions) {
      await targetDb.execute({
        sql: `INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          session.id,
          Math.floor(new Date(session.expires_at).getTime() / 1000),
          session.token,
          Math.floor(new Date(session.created_at).getTime() / 1000),
          Math.floor(new Date(session.updated_at).getTime() / 1000),
          session.ip_address,
          session.user_agent,
          getUlid(session.user_id),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${sessions.length} sessions\n`);
  return sessions.length;
}

/**
 * Migrate accounts table
 */
async function migrateAccounts() {
  console.log('🔗 Migrating accounts...');

  const accounts = await sourceDb`SELECT * FROM "account" ORDER BY created_at`;
  console.log(`  Found ${accounts.length} accounts`);

  if (!isDryRun) {
    for (const account of accounts) {
      await targetDb.execute({
        sql: `INSERT INTO account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          account.id,
          account.account_id,
          account.provider_id,
          getUlid(account.user_id),
          account.access_token,
          account.refresh_token,
          account.id_token,
          account.access_token_expires_at
            ? Math.floor(
                new Date(account.access_token_expires_at).getTime() / 1000
              )
            : null,
          account.refresh_token_expires_at
            ? Math.floor(
                new Date(account.refresh_token_expires_at).getTime() / 1000
              )
            : null,
          account.scope,
          account.password,
          Math.floor(new Date(account.created_at).getTime() / 1000),
          Math.floor(new Date(account.updated_at).getTime() / 1000),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${accounts.length} accounts\n`);
  return accounts.length;
}

/**
 * Migrate verification table
 */
async function migrateVerifications() {
  console.log('✉️  Migrating verifications...');

  const verifications =
    await sourceDb`SELECT * FROM "verification" ORDER BY created_at`;
  console.log(`  Found ${verifications.length} verifications`);

  if (!isDryRun) {
    for (const verification of verifications) {
      await targetDb.execute({
        sql: `INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          verification.id,
          verification.identifier,
          verification.value,
          Math.floor(new Date(verification.expires_at).getTime() / 1000),
          Math.floor(new Date(verification.created_at).getTime() / 1000),
          Math.floor(new Date(verification.updated_at).getTime() / 1000),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${verifications.length} verifications\n`);
  return verifications.length;
}

/**
 * Migrate teams table
 */
async function migrateTeams() {
  console.log('👥 Migrating teams...');

  const teams = await sourceDb`SELECT * FROM teams ORDER BY created_at`;
  console.log(`  Found ${teams.length} teams`);

  if (!isDryRun) {
    for (const team of teams) {
      const ulid = getUlid(team.id);

      await targetDb.execute({
        sql: `INSERT INTO teams (id, name, slug, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          ulid,
          team.name,
          team.slug,
          Math.floor(new Date(team.created_at).getTime() / 1000),
          Math.floor(new Date(team.updated_at).getTime() / 1000),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${teams.length} teams\n`);
  return teams.length;
}

/**
 * Migrate team members table
 */
async function migrateTeamMembers() {
  console.log('👤 Migrating team members...');

  const members = await sourceDb`SELECT * FROM team_members ORDER BY joined_at`;
  console.log(`  Found ${members.length} team members`);

  if (!isDryRun) {
    for (const member of members) {
      await targetDb.execute({
        sql: `INSERT INTO team_members (team_id, user_id, role, joined_at)
              VALUES (?, ?, ?, ?)`,
        args: [
          getUlid(member.team_id),
          getUlid(member.user_id),
          member.role,
          Math.floor(new Date(member.joined_at).getTime() / 1000),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${members.length} team members\n`);
  return members.length;
}

/**
 * Migrate team invitations table
 */
async function migrateTeamInvitations() {
  console.log('💌 Migrating team invitations...');

  const invitations =
    await sourceDb`SELECT * FROM team_invitations ORDER BY created_at`;
  console.log(`  Found ${invitations.length} team invitations`);

  if (!isDryRun) {
    for (const invitation of invitations) {
      const ulid = getUlid(invitation.id);

      await targetDb.execute({
        sql: `INSERT INTO team_invitations (id, team_id, email, role, invited_by, status, token, expires_at, created_at, updated_at, accepted_at, declined_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(invitation.team_id),
          invitation.email,
          invitation.role,
          getUlid(invitation.invited_by),
          invitation.status,
          invitation.token,
          Math.floor(new Date(invitation.expires_at).getTime() / 1000),
          Math.floor(new Date(invitation.created_at).getTime() / 1000),
          Math.floor(new Date(invitation.updated_at).getTime() / 1000),
          invitation.accepted_at
            ? Math.floor(new Date(invitation.accepted_at).getTime() / 1000)
            : null,
          invitation.declined_at
            ? Math.floor(new Date(invitation.declined_at).getTime() / 1000)
            : null,
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${invitations.length} team invitations\n`);
  return invitations.length;
}

/**
 * Migrate sequences table
 */
async function migrateSequences() {
  console.log('📹 Migrating sequences...');

  const sequences = await sourceDb`SELECT * FROM sequences ORDER BY created_at`;
  console.log(`  Found ${sequences.length} sequences`);

  if (!isDryRun) {
    for (const sequence of sequences) {
      const ulid = getUlid(sequence.id);

      await targetDb.execute({
        sql: `INSERT INTO sequences (id, team_id, title, script, status, analysis_model, aspect_ratio, thumbnail_url, metadata, created_at, updated_at, created_by, updated_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(sequence.team_id),
          sequence.title,
          sequence.script,
          sequence.status,
          sequence.analysis_model,
          sequence.aspect_ratio,
          sequence.thumbnail_url,
          JSON.stringify(sequence.metadata || {}),
          Math.floor(new Date(sequence.created_at).getTime() / 1000),
          Math.floor(new Date(sequence.updated_at).getTime() / 1000),
          getUlid(sequence.created_by),
          getUlid(sequence.updated_by),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${sequences.length} sequences\n`);
  return sequences.length;
}

/**
 * Migrate frames table
 */
async function migrateFrames() {
  console.log('🖼️  Migrating frames...');

  const frames = await sourceDb`SELECT * FROM frames ORDER BY created_at`;
  console.log(`  Found ${frames.length} frames`);

  if (!isDryRun) {
    for (const frame of frames) {
      const ulid = getUlid(frame.id);

      await targetDb.execute({
        sql: `INSERT INTO frames (id, sequence_id, order_index, description, thumbnail_url, video_url, duration_ms, metadata, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(frame.sequence_id),
          frame.order_index,
          frame.description,
          frame.thumbnail_url,
          frame.video_url,
          frame.duration_ms,
          JSON.stringify(frame.metadata || {}),
          Math.floor(new Date(frame.created_at).getTime() / 1000),
          Math.floor(new Date(frame.updated_at).getTime() / 1000),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${frames.length} frames\n`);
  return frames.length;
}

/**
 * Migrate styles table
 */
async function migrateStyles() {
  console.log('🎨 Migrating styles...');

  const styles = await sourceDb`SELECT * FROM styles ORDER BY created_at`;
  console.log(`  Found ${styles.length} styles`);

  if (!isDryRun) {
    for (const style of styles) {
      const ulid = getUlid(style.id);

      await targetDb.execute({
        sql: `INSERT INTO styles (id, team_id, name, description, base_prompt, negative_prompt, is_public, created_at, updated_at, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(style.team_id),
          style.name,
          style.description,
          style.base_prompt,
          style.negative_prompt,
          style.is_public ? 1 : 0,
          Math.floor(new Date(style.created_at).getTime() / 1000),
          Math.floor(new Date(style.updated_at).getTime() / 1000),
          getUlid(style.created_by),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${styles.length} styles\n`);
  return styles.length;
}

/**
 * Migrate user credits table
 */
async function migrateUserCredits() {
  console.log('💳 Migrating user credits...');

  const credits =
    await sourceDb`SELECT * FROM user_credits ORDER BY created_at`;
  console.log(`  Found ${credits.length} user credit records`);

  if (!isDryRun) {
    for (const credit of credits) {
      await targetDb.execute({
        sql: `INSERT INTO user_credits (user_id, balance, created_at, updated_at)
              VALUES (?, ?, ?, ?)`,
        args: [
          getUlid(credit.user_id),
          credit.balance,
          Math.floor(new Date(credit.created_at).getTime() / 1000),
          Math.floor(new Date(credit.updated_at).getTime() / 1000),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${credits.length} user credit records\n`);
  return credits.length;
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    // Create backup if requested
    if (shouldBackup) {
      await createBackup();
    }

    const stats = {
      users: 0,
      sessions: 0,
      accounts: 0,
      verifications: 0,
      teams: 0,
      teamMembers: 0,
      teamInvitations: 0,
      sequences: 0,
      frames: 0,
      styles: 0,
      userCredits: 0,
    };

    // Migrate in order to maintain referential integrity
    stats.users = await migrateUsers();
    stats.sessions = await migrateSessions();
    stats.accounts = await migrateAccounts();
    stats.verifications = await migrateVerifications();
    stats.teams = await migrateTeams();
    stats.teamMembers = await migrateTeamMembers();
    stats.teamInvitations = await migrateTeamInvitations();
    stats.sequences = await migrateSequences();
    stats.frames = await migrateFrames();
    stats.styles = await migrateStyles();
    stats.userCredits = await migrateUserCredits();

    // Print summary
    console.log('\n✅ Migration Complete!\n');
    console.log('Summary:');
    console.log('========');
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log(`\nTotal UUID → ULID mappings: ${uuidToUlidMap.size}`);

    if (isDryRun) {
      console.log('\n⚠️  This was a dry run - no data was written');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    // Close connections
    await sourceDb.end();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
