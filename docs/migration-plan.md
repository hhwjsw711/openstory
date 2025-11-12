# Complete Migration Plan: Supabase → Turso + R2

This document outlines the complete migration from Supabase (PostgreSQL + Storage) to Turso (SQLite) + Cloudflare R2, including UUID → ULID conversion.

## Overview

**What we're migrating:**
- ✅ Database: PostgreSQL (Supabase) → SQLite (Turso)
- ✅ IDs: UUID v4 → ULID
- ✅ Storage: Supabase Storage → Cloudflare R2
- ✅ Data: All existing production data
- ✅ Files: All production files (images, videos, audio, etc.)

**Complexity:** High - involves data transformation, ID mapping, and storage migration

**Estimated time:** 8-12 hours

**Risk level:** Medium-High (but reversible with proper backups)

## Prerequisites

### 1. Infrastructure Setup

**Turso Database:**
```bash
# Install Turso CLI
brew install tursodatabase/tap/turso
# or: curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Create database
turso db create velro-production --location ord  # Choose closest region

# Get connection details
turso db show velro-production --url
turso db tokens create velro-production

# Save these for .env:
# TURSO_DATABASE_URL=libsql://velro-production-<org>.turso.io
# TURSO_AUTH_TOKEN=<token>
```

**Cloudflare R2:**
```bash
# Install Wrangler
bun add -g wrangler

# Login
wrangler login

# Create bucket
wrangler r2 bucket create velro-production

# Create API token
# Go to Cloudflare Dashboard → R2 → Manage R2 API Tokens
# Or use: wrangler r2 token create velro-api-token

# Save for .env:
# R2_ACCOUNT_ID=<account-id>
# R2_ACCESS_KEY_ID=<access-key>
# R2_SECRET_ACCESS_KEY=<secret-key>
# R2_BUCKET_NAME=velro-production
```

### 2. Backup Current Production

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Export Supabase database
# Via Supabase Dashboard: Database → Backups → Manual backup
# Or via SQL dump:
pg_dump "$POSTGRES_URL" > backups/$(date +%Y%m%d)/supabase-dump.sql

# Document current state
echo "Backup created: $(date)" > backups/$(date +%Y%m%d)/README.txt
echo "Tables:" >> backups/$(date +%Y%m%d)/README.txt
# List table counts
```

### 3. Install Dependencies

```bash
# Add new dependencies
bun add @libsql/client ulid @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Remove old dependencies (after migration complete)
# bun remove @supabase/supabase-js @supabase/ssr postgres
```

## Phase 1: Code Changes (No Data Yet)

### Step 1: Create ULID Utility

Create `src/lib/db/id.ts` with the ULID utility from the example doc.

### Step 2: Convert Schema Files

Convert all 7 schema files to SQLite + ULID:
- `src/lib/db/schema/auth.ts`
- `src/lib/db/schema/teams.ts`
- `src/lib/db/schema/sequences.ts`
- `src/lib/db/schema/libraries.ts`
- `src/lib/db/schema/tracking.ts`
- `src/lib/db/schema/credits.ts`
- `src/lib/db/schema/audit.ts`

Key changes per file:
```typescript
// Change imports
import { pgTable, uuid, timestamp, jsonb } from 'drizzle-orm/pg-core';
// ↓
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';

// Change table function
export const users = pgTable(...)
// ↓
export const users = sqliteTable(...)

// Change ID columns
id: uuid().default(sql`uuid_generate_v4()`)
// ↓
id: text().$defaultFn(() => generateId())

// Change timestamps
createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow()
// ↓
createdAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date())

// Change JSONB
metadata: jsonb().$type<T>()
// ↓
metadata: text({ mode: 'json' }).$type<T>()

// Remove $onUpdate (handle in app code - already doing this!)
updatedAt: timestamp().$onUpdate(() => new Date())
// ↓
updatedAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date())

// Change enums to text with types
export const status = pgEnum('status', ['draft', 'active'])
// ↓
export const STATUS_VALUES = ['draft', 'active'] as const;
export type Status = typeof STATUS_VALUES[number];
status: text().$type<Status>().default('draft')

// Simplify indexes (remove .using() and .op())
index('idx').using('btree', col.asc().op('uuid_ops'))
// ↓
index('idx').on(col)

// Remove pgPolicy (no RLS in SQLite)
pgPolicy(...) // Delete entirely
```

### Step 3: Update Database Client

**Replace `src/lib/db/pool.ts` and `src/lib/db/client.ts`:**

```typescript
// src/lib/db/client.ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { schema } from './schema';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
}

const client = createClient({
  url: tursoUrl,
  authToken: tursoToken,
});

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development',
  casing: 'snake_case',
});

export type Database = typeof db;
```

**Delete `src/lib/db/pool.ts`** (no longer needed)

### Step 4: Update Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
}

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: tursoUrl,
    authToken: tursoToken,
  },
  verbose: true,
  strict: true,
  casing: 'snake_case',
});
```

### Step 5: Update Validation Schemas

Find and update all Zod schemas that validate UUIDs:

```typescript
// Before
import { z } from 'zod';
const uuidSchema = z.string().uuid();

// After
import { z } from 'zod';
import { isValidId } from '@/lib/db/id';

const idSchema = z.string().refine(isValidId, {
  message: 'Invalid ID format',
});

// Update all API route schemas
export const createSequenceSchema = z.object({
  teamId: idSchema,  // was: z.string().uuid()
  styleId: idSchema,
  // ...
});
```

### Step 6: Update Storage Helper

Replace `src/lib/db/helpers/storage.ts` with R2 implementation from the R2 migration doc.

### Step 7: Update Better Auth Config

```typescript
// src/lib/auth/config.ts
import { generateId } from '@/lib/db/id';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',  // Changed from 'pg'
    schema: {
      user: user,
      session: session,
      account: account,
      verification: verification,
    },
  }),

  // ... rest of config

  advanced: {
    database: {
      generateId: () => generateId(),  // Use ULID
    },
  },
});
```

### Step 8: Generate Migrations

```bash
# Generate new SQLite migrations
bun db:generate

# Review the generated migration in drizzle/migrations/
# Should create all tables with TEXT ids, INTEGER timestamps, etc.
```

## Phase 2: Data Migration Script

Create `scripts/migrate-data.ts`:

```typescript
/**
 * Data Migration Script: Supabase → Turso (UUID → ULID)
 *
 * This script:
 * 1. Exports all data from Supabase PostgreSQL
 * 2. Converts UUID → ULID with mapping table
 * 3. Imports data into Turso with new IDs
 * 4. Updates storage URLs in database (Supabase → R2)
 */

import { createClient } from '@supabase/supabase-js';
import { createClient as createTursoClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { generateId } from '@/lib/db/id';
import { schema } from '@/lib/db/schema';

// UUID → ULID mapping
const idMap = new Map<string, string>();

function convertId(oldUuid: string): string {
  if (!idMap.has(oldUuid)) {
    idMap.set(oldUuid, generateId());
  }
  return idMap.get(oldUuid)!;
}

async function migrateData() {
  console.log('🚀 Starting data migration...\n');

  // Connect to Supabase (source)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // Need service role for full access
  );

  // Connect to Turso (destination)
  const tursoClient = createTursoClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  const turso = drizzle(tursoClient, { schema });

  try {
    // Step 1: Export users
    console.log('📤 Exporting users...');
    const { data: users } = await supabase.from('user').select('*');
    console.log(`Found ${users?.length || 0} users`);

    // Step 2: Export teams
    console.log('📤 Exporting teams...');
    const { data: teams } = await supabase.from('teams').select('*');
    console.log(`Found ${teams?.length || 0} teams`);

    // Step 3: Export team members
    console.log('📤 Exporting team members...');
    const { data: teamMembers } = await supabase.from('team_members').select('*');
    console.log(`Found ${teamMembers?.length || 0} team members`);

    // Step 4: Export styles
    console.log('📤 Exporting styles...');
    const { data: styles } = await supabase.from('styles').select('*');
    console.log(`Found ${styles?.length || 0} styles`);

    // Step 5: Export sequences
    console.log('📤 Exporting sequences...');
    const { data: sequences } = await supabase.from('sequences').select('*');
    console.log(`Found ${sequences?.length || 0} sequences`);

    // Step 6: Export frames
    console.log('📤 Exporting frames...');
    const { data: frames } = await supabase.from('frames').select('*');
    console.log(`Found ${frames?.length || 0} frames`);

    // Step 7: Export other tables (characters, vfx, audio, etc.)
    // ... similar exports

    console.log('\n🔄 Converting IDs and importing to Turso...\n');

    // Import users with new ULIDs
    if (users && users.length > 0) {
      console.log('📥 Importing users...');
      const convertedUsers = users.map((user: any) => ({
        ...user,
        id: convertId(user.id),
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      }));

      await turso.insert(schema.user).values(convertedUsers);
      console.log(`✅ Imported ${convertedUsers.length} users`);
    }

    // Import teams with new ULIDs
    if (teams && teams.length > 0) {
      console.log('📥 Importing teams...');
      const convertedTeams = teams.map((team: any) => ({
        ...team,
        id: convertId(team.id),
        ownerId: convertId(team.owner_id),
        createdAt: new Date(team.created_at),
        updatedAt: new Date(team.updated_at),
      }));

      await turso.insert(schema.teams).values(convertedTeams);
      console.log(`✅ Imported ${convertedTeams.length} teams`);
    }

    // Import sequences with storage URL updates
    if (sequences && sequences.length > 0) {
      console.log('📥 Importing sequences...');
      const convertedSequences = sequences.map((seq: any) => ({
        ...seq,
        id: convertId(seq.id),
        teamId: convertId(seq.team_id),
        styleId: convertId(seq.style_id),
        createdBy: seq.created_by ? convertId(seq.created_by) : null,
        updatedBy: seq.updated_by ? convertId(seq.updated_by) : null,
        createdAt: new Date(seq.created_at),
        updatedAt: new Date(seq.updated_at),
      }));

      await turso.insert(schema.sequences).values(convertedSequences);
      console.log(`✅ Imported ${convertedSequences.length} sequences`);
    }

    // Import frames with storage URL updates
    if (frames && frames.length > 0) {
      console.log('📥 Importing frames...');
      const convertedFrames = frames.map((frame: any) => ({
        ...frame,
        id: convertId(frame.id),
        sequenceId: convertId(frame.sequence_id),
        // Update storage URLs: Supabase → R2
        thumbnailUrl: frame.thumbnail_url ?
          frame.thumbnail_url.replace(
            process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public/',
            process.env.R2_PUBLIC_URL + '/'
          ) : null,
        videoUrl: frame.video_url ?
          frame.video_url.replace(
            process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public/',
            process.env.R2_PUBLIC_URL + '/'
          ) : null,
        createdAt: new Date(frame.created_at),
        updatedAt: new Date(frame.updated_at),
      }));

      await turso.insert(schema.frames).values(convertedFrames);
      console.log(`✅ Imported ${convertedFrames.length} frames`);
    }

    // Continue for all other tables...

    // Save ID mapping for reference
    console.log('\n💾 Saving ID mapping...');
    const mappingJson = JSON.stringify(
      Array.from(idMap.entries()),
      null,
      2
    );
    await Bun.write(
      `backups/${new Date().toISOString().split('T')[0]}/id-mapping.json`,
      mappingJson
    );

    console.log('\n✅ Migration completed successfully!');
    console.log(`Total IDs converted: ${idMap.size}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateData().catch(console.error);
```

## Phase 3: Storage Migration Script

Create `scripts/migrate-storage.ts`:

```typescript
/**
 * Storage Migration Script: Supabase Storage → Cloudflare R2
 *
 * This script:
 * 1. Lists all files in Supabase Storage buckets
 * 2. Downloads each file
 * 3. Uploads to R2 with same path structure
 * 4. Verifies successful migration
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const BUCKETS = ['thumbnails', 'videos', 'audio', 'styles', 'characters', 'vfx'];

async function migrateStorage() {
  console.log('🚀 Starting storage migration...\n');

  // Supabase Storage client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // R2 client
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  let totalFiles = 0;
  let migratedFiles = 0;
  let failedFiles = 0;

  for (const bucket of BUCKETS) {
    console.log(`\n📦 Processing bucket: ${bucket}`);

    try {
      // List all files in Supabase bucket
      const { data: files, error } = await supabase.storage
        .from(bucket)
        .list('', {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) {
        console.error(`❌ Error listing files in ${bucket}:`, error);
        continue;
      }

      if (!files || files.length === 0) {
        console.log(`  ℹ️  No files in ${bucket}`);
        continue;
      }

      console.log(`  Found ${files.length} files`);
      totalFiles += files.length;

      // Process each file
      for (const file of files) {
        const filePath = file.name;
        console.log(`  📄 Migrating: ${filePath}`);

        try {
          // Download from Supabase
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(bucket)
            .download(filePath);

          if (downloadError || !fileData) {
            console.error(`    ❌ Download failed: ${downloadError?.message}`);
            failedFiles++;
            continue;
          }

          // Convert to Buffer
          const buffer = Buffer.from(await fileData.arrayBuffer());

          // Upload to R2
          const key = `${bucket}/${filePath}`;
          await r2.send(
            new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME!,
              Key: key,
              Body: buffer,
              ContentType: fileData.type || 'application/octet-stream',
              CacheControl: 'public, max-age=31536000',
            })
          );

          // Verify upload
          await r2.send(
            new HeadObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME!,
              Key: key,
            })
          );

          console.log(`    ✅ Migrated successfully`);
          migratedFiles++;
        } catch (error) {
          console.error(`    ❌ Migration failed:`, error);
          failedFiles++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing bucket ${bucket}:`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`Total files found:    ${totalFiles}`);
  console.log(`Successfully migrated: ${migratedFiles}`);
  console.log(`Failed:               ${failedFiles}`);
  console.log('='.repeat(60));

  if (failedFiles > 0) {
    console.log('\n⚠️  Some files failed to migrate. Review logs above.');
    process.exit(1);
  } else {
    console.log('\n✅ All files migrated successfully!');
  }
}

// Run migration
migrateStorage().catch(console.error);
```

## Phase 4: Execution Plan

### Pre-migration Checklist

- [ ] Turso database created and credentials saved
- [ ] R2 bucket created and credentials saved
- [ ] All code changes completed and tested locally
- [ ] Backup of production database completed
- [ ] ID mapping strategy understood
- [ ] Rollback plan documented

### Execution Steps

**1. Maintenance Mode (Optional)**
```bash
# If needed, enable maintenance mode in production
# to prevent new data during migration
```

**2. Push Schema to Turso**
```bash
# Push new schema
bun db:push

# Verify tables created
turso db shell velro-production ".tables"
```

**3. Migrate Data**
```bash
# Run data migration script
SUPABASE_SERVICE_ROLE_KEY=<key> bun run scripts/migrate-data.ts

# This will:
# - Export all data from Supabase
# - Convert UUID → ULID
# - Import to Turso
# - Save ID mapping file
```

**4. Migrate Storage**
```bash
# Run storage migration script
SUPABASE_SERVICE_ROLE_KEY=<key> bun run scripts/migrate-storage.ts

# This will:
# - Copy all files from Supabase Storage to R2
# - Maintain folder structure
# - Verify uploads
```

**5. Update Environment Variables**
```bash
# Update production environment (Vercel/your platform)
# Remove:
# - POSTGRES_URL
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY

# Add:
# - TURSO_DATABASE_URL
# - TURSO_AUTH_TOKEN
# - R2_ACCOUNT_ID
# - R2_ACCESS_KEY_ID
# - R2_SECRET_ACCESS_KEY
# - R2_BUCKET_NAME
# - R2_PUBLIC_URL
```

**6. Deploy**
```bash
# Deploy new code
git push origin main

# Or manual deployment
vercel --prod
```

**7. Verify**
```bash
# Test critical flows:
# - User login
# - Sequence creation
# - Frame generation
# - File uploads
# - File access
```

## Phase 5: Post-Migration

### Verification Checklist

- [ ] All users can log in
- [ ] All sequences visible
- [ ] All frames display correctly
- [ ] Thumbnails load properly
- [ ] Videos play correctly
- [ ] New uploads work
- [ ] Workflows execute successfully
- [ ] No console errors

### Cleanup

```bash
# Once verified (wait 1-2 weeks):

# 1. Remove Supabase dependencies
bun remove @supabase/supabase-js @supabase/ssr postgres supabase

# 2. Delete Supabase-related files
rm -rf src/lib/supabase
rm -rf supabase/

# 3. Remove Supabase scripts from package.json
# Delete: supabase:start, supabase:stop, supabase:types

# 4. Delete old storage (carefully!)
# Via Supabase Dashboard: Storage → Empty buckets → Delete buckets

# 5. Cancel Supabase subscription
```

## Rollback Strategy

If migration fails:

**1. Revert Code**
```bash
git revert HEAD
git push origin main
```

**2. Restore Environment Variables**
```bash
# Re-add Supabase credentials
# Remove Turso/R2 credentials
```

**3. Redeploy**
```bash
vercel --prod
```

**4. Investigate**
- Review migration logs
- Check ID mapping file
- Verify data integrity
- Fix issues
- Try again

## Risk Mitigation

**Data Loss Prevention:**
- ✅ Full database backup before migration
- ✅ ID mapping file saved
- ✅ Storage files copied (not moved)
- ✅ Keep Supabase active for 2 weeks post-migration

**Downtime Minimization:**
- ✅ Migration scripts run offline
- ✅ Quick deployment after migration
- ✅ Can run during low-traffic period

**Testing:**
- ✅ Test on staging environment first (if available)
- ✅ Dry run of migration scripts
- ✅ Verify all critical paths work

## Success Criteria

Migration is successful when:
- ✅ All data migrated to Turso with new ULIDs
- ✅ All storage files accessible via R2
- ✅ Application works without errors
- ✅ No data loss
- ✅ No broken references
- ✅ Performance is acceptable
- ✅ Users can work normally

## Support

If issues arise:
1. Check migration logs
2. Review ID mapping file
3. Verify environment variables
4. Test database connectivity
5. Check storage URLs
6. Review Better Auth logs
7. Check Turso dashboard
8. Check R2 dashboard

## Timeline

- **Day 1**: Infrastructure setup + code changes
- **Day 2**: Migration scripts + local testing
- **Day 3**: Production migration + verification
- **Week 2**: Monitor and stabilize
- **Week 3-4**: Cleanup old infrastructure

Let's go! 🚀
