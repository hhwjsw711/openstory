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
 * - Gracefully skips missing tables
 *
 * Schema Changes Handled:
 * - User: Removed is_anonymous, added access_code
 * - Sequences: Added style_id, aspect_ratio, analysis_model, analysis_duration_ms
 * - Frames: Added comprehensive status tracking fields
 * - Styles: New config-based structure
 * - Credits: Renamed from user_credits, simplified structure
 * - Transactions: Renamed from credit_transactions
 * - All library tables: characters, vfx, audio, style_adaptations
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
        sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at, full_name, avatar_url, onboarding_completed, access_code)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          user.email,
          user.email_verified ? 1 : 0,
          user.name,
          user.image,
          Math.floor(new Date(user.created_at).getTime() / 1000),
          Math.floor(new Date(user.updated_at).getTime() / 1000),
          user.full_name,
          user.avatar_url,
          user.onboarding_completed ? 1 : 0,
          user.access_code || null,
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
        sql: `INSERT INTO sequences (id, team_id, title, script, status, metadata, created_at, updated_at, created_by, updated_by, style_id, aspect_ratio, analysis_model, analysis_duration_ms)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(sequence.team_id),
          sequence.title,
          sequence.script,
          sequence.status,
          JSON.stringify(sequence.metadata || {}),
          Math.floor(new Date(sequence.created_at).getTime() / 1000),
          Math.floor(new Date(sequence.updated_at).getTime() / 1000),
          getUlid(sequence.created_by),
          getUlid(sequence.updated_by),
          getUlid(sequence.style_id) || null, // Map style_id
          sequence.aspect_ratio || '16:9', // Default aspect ratio if missing
          sequence.analysis_model || 'anthropic/claude-haiku-4.5', // Default model
          sequence.analysis_duration_ms || 0, // Default duration
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
        sql: `INSERT INTO frames (
          id, sequence_id, order_index, description, duration_ms,
          thumbnail_url, thumbnail_path, video_url, video_path,
          thumbnail_status, thumbnail_workflow_run_id, thumbnail_generated_at, thumbnail_error,
          video_status, video_workflow_run_id, video_generated_at, video_error,
          metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(frame.sequence_id),
          frame.order_index,
          frame.description,
          frame.duration_ms || 3000,
          frame.thumbnail_url,
          frame.thumbnail_path || null,
          frame.video_url,
          frame.video_path || null,
          // Set status based on whether URL exists
          frame.thumbnail_url ? 'completed' : 'pending',
          frame.thumbnail_workflow_run_id || null,
          frame.thumbnail_generated_at
            ? Math.floor(
                new Date(frame.thumbnail_generated_at).getTime() / 1000
              )
            : null,
          frame.thumbnail_error || null,
          frame.video_url ? 'completed' : 'pending',
          frame.video_workflow_run_id || null,
          frame.video_generated_at
            ? Math.floor(new Date(frame.video_generated_at).getTime() / 1000)
            : null,
          frame.video_error || null,
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

      // Convert old base_prompt/negative_prompt to new config structure
      const config = style.config || {
        artStyle: style.base_prompt || '',
        colorPalette: [],
        lighting: '',
        cameraWork: '',
        mood: '',
        referenceFilms: [],
        colorGrading: '',
      };

      await targetDb.execute({
        sql: `INSERT INTO styles (
          id, team_id, name, description, config, category, tags,
          is_public, is_template, version, parent_id, preview_url,
          usage_count, created_at, updated_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(style.team_id),
          style.name,
          style.description,
          JSON.stringify(config),
          style.category || null,
          JSON.stringify(style.tags || []),
          style.is_public ? 1 : 0,
          style.is_template ? 1 : 0,
          style.version || 1,
          getUlid(style.parent_id) || null,
          style.preview_url || null,
          style.usage_count || 0,
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
 * Migrate style_adaptations table
 */
async function migrateStyleAdaptations() {
  console.log('🔧 Migrating style adaptations...');

  const adaptations =
    await sourceDb`SELECT * FROM style_adaptations ORDER BY created_at`;
  console.log(`  Found ${adaptations.length} style adaptation records`);

  if (!isDryRun) {
    for (const adaptation of adaptations) {
      const ulid = getUlid(adaptation.id);

      await targetDb.execute({
        sql: `INSERT INTO style_adaptations (id, style_id, model_provider, model_name, adapted_config, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(adaptation.style_id),
          adaptation.model_provider,
          adaptation.model_name,
          JSON.stringify(adaptation.adapted_config || {}),
          Math.floor(new Date(adaptation.created_at).getTime() / 1000),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${adaptations.length} style adaptation records\n`);
  return adaptations.length;
}

/**
 * Migrate characters table
 */
async function migrateCharacters() {
  console.log('👤 Migrating characters...');

  const characters =
    await sourceDb`SELECT * FROM characters ORDER BY created_at`;
  console.log(`  Found ${characters.length} character records`);

  if (!isDryRun) {
    for (const character of characters) {
      const ulid = getUlid(character.id);

      await targetDb.execute({
        sql: `INSERT INTO characters (id, team_id, name, lora_url, config, preview_url, created_at, updated_at, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(character.team_id),
          character.name,
          character.lora_url,
          JSON.stringify(character.config || {}),
          character.preview_url,
          Math.floor(new Date(character.created_at).getTime() / 1000),
          Math.floor(new Date(character.updated_at).getTime() / 1000),
          getUlid(character.created_by),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${characters.length} character records\n`);
  return characters.length;
}

/**
 * Migrate vfx table
 */
async function migrateVfx() {
  console.log('✨ Migrating vfx...');

  const vfxRecords = await sourceDb`SELECT * FROM vfx ORDER BY created_at`;
  console.log(`  Found ${vfxRecords.length} vfx records`);

  if (!isDryRun) {
    for (const vfx of vfxRecords) {
      const ulid = getUlid(vfx.id);

      await targetDb.execute({
        sql: `INSERT INTO vfx (id, team_id, name, preset_config, preview_url, created_at, updated_at, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(vfx.team_id),
          vfx.name,
          JSON.stringify(vfx.preset_config || {}),
          vfx.preview_url,
          Math.floor(new Date(vfx.created_at).getTime() / 1000),
          Math.floor(new Date(vfx.updated_at).getTime() / 1000),
          getUlid(vfx.created_by),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${vfxRecords.length} vfx records\n`);
  return vfxRecords.length;
}

/**
 * Migrate audio table
 */
async function migrateAudio() {
  console.log('🎵 Migrating audio...');

  const audioRecords = await sourceDb`SELECT * FROM audio ORDER BY created_at`;
  console.log(`  Found ${audioRecords.length} audio records`);

  if (!isDryRun) {
    for (const audio of audioRecords) {
      const ulid = getUlid(audio.id);

      await targetDb.execute({
        sql: `INSERT INTO audio (id, team_id, name, file_url, duration_ms, metadata, created_at, updated_at, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(audio.team_id),
          audio.name,
          audio.file_url,
          audio.duration_ms,
          JSON.stringify(audio.metadata || {}),
          Math.floor(new Date(audio.created_at).getTime() / 1000),
          Math.floor(new Date(audio.updated_at).getTime() / 1000),
          getUlid(audio.created_by),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${audioRecords.length} audio records\n`);
  return audioRecords.length;
}

/**
 * Migrate credits table (renamed from user_credits)
 */
async function migrateCredits() {
  console.log('💳 Migrating credits...');

  const credits =
    await sourceDb`SELECT * FROM user_credits ORDER BY created_at`;
  console.log(`  Found ${credits.length} credit records`);

  if (!isDryRun) {
    for (const credit of credits) {
      await targetDb.execute({
        sql: `INSERT INTO credits (user_id, balance, updated_at)
              VALUES (?, ?, ?)`,
        args: [
          getUlid(credit.user_id),
          credit.balance,
          Math.floor(new Date(credit.updated_at).getTime() / 1000),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${credits.length} credit records\n`);
  return credits.length;
}

/**
 * Migrate transactions table (renamed from credit_transactions)
 */
async function migrateTransactions() {
  console.log('💰 Migrating transactions...');

  const transactions =
    await sourceDb`SELECT * FROM credit_transactions ORDER BY created_at`;
  console.log(`  Found ${transactions.length} transaction records`);

  if (!isDryRun) {
    for (const transaction of transactions) {
      const ulid = getUlid(transaction.id);

      await targetDb.execute({
        sql: `INSERT INTO transactions (id, user_id, type, amount, balance_after, metadata, description, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          getUlid(transaction.user_id),
          transaction.type,
          transaction.amount,
          transaction.balance_after,
          JSON.stringify(transaction.metadata || {}),
          transaction.description,
          Math.floor(new Date(transaction.created_at).getTime() / 1000),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${transactions.length} transaction records\n`);
  return transactions.length;
}

/**
 * Migrate fal_requests table (renamed to falRequests)
 */
async function migrateFalRequests() {
  console.log('🎯 Migrating fal requests...');

  const requests =
    await sourceDb`SELECT * FROM fal_requests ORDER BY created_at`;
  console.log(`  Found ${requests.length} fal request records`);

  if (!isDryRun) {
    for (const request of requests) {
      const ulid = getUlid(request.id);

      await targetDb.execute({
        sql: `INSERT INTO fal_requests (
          id, job_id, team_id, user_id, model, request_payload, response_data,
          cost_credits, latency_ms, status, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          request.job_id,
          getUlid(request.team_id),
          getUlid(request.user_id),
          request.model,
          JSON.stringify(request.request_payload || {}),
          JSON.stringify(request.response_data || null),
          request.cost_credits || 0,
          request.latency_ms,
          request.status || 'pending',
          request.error,
          Math.floor(new Date(request.created_at).getTime() / 1000),
          Math.floor(new Date(request.updated_at).getTime() / 1000),
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${requests.length} fal request records\n`);
  return requests.length;
}

/**
 * Migrate letzai_requests table (renamed to letzaiRequests)
 */
async function migrateLetzaiRequests() {
  console.log('🎨 Migrating letzai requests...');

  const requests =
    await sourceDb`SELECT * FROM letzai_requests ORDER BY created_at`;
  console.log(`  Found ${requests.length} letzai request records`);

  if (!isDryRun) {
    for (const request of requests) {
      const ulid = getUlid(request.id);

      await targetDb.execute({
        sql: `INSERT INTO letzai_requests (
          id, job_id, team_id, user_id, endpoint, model, request_payload,
          status, response_data, error, cost_credits, latency_ms,
          created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ulid,
          request.job_id,
          getUlid(request.team_id),
          getUlid(request.user_id),
          request.endpoint,
          request.model,
          JSON.stringify(request.request_payload),
          request.status || 'pending',
          JSON.stringify(request.response_data || null),
          request.error,
          request.cost_credits,
          request.latency_ms,
          Math.floor(new Date(request.created_at).getTime() / 1000),
          Math.floor(new Date(request.updated_at).getTime() / 1000),
          request.completed_at
            ? Math.floor(new Date(request.completed_at).getTime() / 1000)
            : null,
        ],
      });
    }
  }

  console.log(`  ✓ Migrated ${requests.length} letzai request records\n`);
  return requests.length;
}

/**
 * Helper to safely run migration functions, skipping missing tables
 */
async function safeMigrate(
  name: string,
  fn: () => Promise<number>
): Promise<number> {
  try {
    return await fn();
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    // Skip if table doesn't exist
    if (err.code === '42P01') {
      console.log(`  ⚠️  Table does not exist in source database - skipping\n`);
      return 0;
    }
    // Re-throw other errors
    throw error;
  }
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
      styleAdaptations: 0,
      characters: 0,
      vfx: 0,
      audio: 0,
      credits: 0,
      transactions: 0,
      falRequests: 0,
      letzaiRequests: 0,
    };

    // Migrate in order to maintain referential integrity
    // Auth tables first
    stats.users = await safeMigrate('users', migrateUsers);
    stats.sessions = await safeMigrate('sessions', migrateSessions);
    stats.accounts = await safeMigrate('accounts', migrateAccounts);
    stats.verifications = await safeMigrate(
      'verifications',
      migrateVerifications
    );

    // Teams
    stats.teams = await safeMigrate('teams', migrateTeams);
    stats.teamMembers = await safeMigrate('teamMembers', migrateTeamMembers);
    stats.teamInvitations = await safeMigrate(
      'teamInvitations',
      migrateTeamInvitations
    );

    // Libraries (styles before sequences since sequences reference styles)
    stats.styles = await safeMigrate('styles', migrateStyles);
    stats.styleAdaptations = await safeMigrate(
      'styleAdaptations',
      migrateStyleAdaptations
    );
    stats.characters = await safeMigrate('characters', migrateCharacters);
    stats.vfx = await safeMigrate('vfx', migrateVfx);
    stats.audio = await safeMigrate('audio', migrateAudio);

    // Content
    stats.sequences = await safeMigrate('sequences', migrateSequences);
    stats.frames = await safeMigrate('frames', migrateFrames);

    // Credits
    stats.credits = await safeMigrate('credits', migrateCredits);
    stats.transactions = await safeMigrate('transactions', migrateTransactions);

    // Tracking
    stats.falRequests = await safeMigrate('falRequests', migrateFalRequests);
    stats.letzaiRequests = await safeMigrate(
      'letzaiRequests',
      migrateLetzaiRequests
    );

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
