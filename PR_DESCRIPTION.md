# Migrate from Supabase (PostgreSQL + UUID) to Turso (SQLite + ULID)

## Summary

This PR migrates the entire database infrastructure from Supabase (PostgreSQL with UUIDs) to Turso (SQLite with ULIDs). This is a major architectural change that improves performance, reduces costs, and provides better scalability.

## Motivation

**Why Turso?**

- **Edge-first database**: Turso replicates data globally for lower latency
- **Cost-effective**: No connection pooling needed, pay for what you use
- **Built for serverless**: Native HTTP API, no persistent connections
- **SQLite compatibility**: Leverage SQLite's simplicity and performance

**Why ULID over UUID?**

- **Time-ordered**: ULIDs are lexicographically sortable by creation time
- **Better indexing**: Sequential IDs improve B-tree index performance
- **Shorter**: 26 characters vs 36 for UUIDs (better storage/bandwidth)
- **No collisions**: Still globally unique like UUIDs

## Changes Made

### 1. Database Schema Conversion (7 files)

Converted all Drizzle schemas from PostgreSQL to SQLite:

- **`auth.ts`** - Users, sessions, accounts, verification tables
- **`teams.ts`** - Teams, members, invitations
- **`sequences.ts`** - Sequences and frames
- **`libraries.ts`** - Styles, characters, VFX, audio
- **`tracking.ts`** - API request tracking
- **`credits.ts`** - User credits and transactions
- **`audit.ts`** - Audit logging

**Key Schema Changes:**

- `uuid()` → `text()` with ULID generation
- `timestamp({ withTimezone: true })` → `integer({ mode: 'timestamp' })`
- `boolean()` → `integer({ mode: 'boolean' })`
- `jsonb()` → `text({ mode: 'json' })`
- `pgEnum` → TypeScript const arrays
- Removed PostgreSQL-specific features (RLS policies, `$onUpdate`, GIN indexes)

### 2. Database Client & Configuration

- **Created** `src/lib/db/id.ts` - ULID generation and validation utilities
- **Updated** `src/lib/db/client.ts` - Switched from `postgres.js` to `@libsql/client`
- **Updated** `drizzle.config.ts` - Changed dialect from `postgresql` to `turso`
- **Deleted** `src/lib/db/pool.ts` - No longer needed with libSQL

### 3. Authentication Updates

- **Updated** `src/lib/auth/config.ts`:
  - Changed Better Auth provider from `'pg'` to `'sqlite'`
  - Updated ID generation to use `generateId()` (ULID)
  - Updated environment validation for Turso credentials

### 4. Validation Schema Updates

- **Created** `src/lib/schemas/id.schemas.ts` - Shared ULID validation schemas
- **Updated** 5 Zod schema files to use ULID validation:
  - `sequence.schemas.ts`
  - `frame.schemas.ts`
  - `fal-request.ts`
  - `letzai-request.ts`
  - `team.schemas.ts`

### 5. Data Migration

- **Created** `scripts/migrate-supabase-to-turso.ts`:
  - Migrates all 19+ database tables
  - Converts UUIDs to ULIDs with consistent mapping
  - Preserves all relationships and referential integrity
  - Supports `--dry-run` and `--backup` flags
  - Handles all data type conversions automatically

### 6. Dependencies

- **Added** `@libsql/client` ^0.14.0 - Turso database client
- **Added** `ulid` ^2.3.0 - ULID generation
- **Kept** `postgres` ^3.4.7 - Only for migration script

### 7. Documentation

- **Created** `docs/migration-steps.md` - Comprehensive migration guide:
  - Turso setup instructions
  - Step-by-step migration process
  - Data verification procedures
  - Rollback plan
  - Troubleshooting guide

## Testing Checklist

Before merging, verify:

- [ ] Set up Turso database and obtain credentials
- [ ] Run `bun db:generate` to create SQLite migrations
- [ ] Run `bun db:push` to apply schema to Turso
- [ ] Run migration script in dry-run mode: `bun scripts/migrate-supabase-to-turso.ts --dry-run --backup`
- [ ] Review migration output for correctness
- [ ] Run actual migration: `bun scripts/migrate-supabase-to-turso.ts --backup`
- [ ] Verify data integrity in Turso using `bun db:studio`
- [ ] Test authentication (login, signup, anonymous users)
- [ ] Test team operations (create, invite, join)
- [ ] Test sequence creation and frame generation
- [ ] Test all CRUD operations
- [ ] Verify API endpoints work correctly
- [ ] Run full test suite: `bun test`

## Migration Steps

See `docs/migration-steps.md` for detailed instructions.

**Quick Start:**

```bash
# 1. Setup Turso
turso auth login
turso db create velro-production
turso db show velro-production --url
turso db tokens create velro-production

# 2. Configure environment
export TURSO_DATABASE_URL="libsql://..."
export TURSO_AUTH_TOKEN="..."

# 3. Generate and apply migrations
bun db:generate
bun db:push

# 4. Migrate data (with backup)
bun scripts/migrate-supabase-to-turso.ts --backup

# 5. Verify
bun db:studio
```

## Rollback Plan

If issues arise:

1. Revert environment variables to use Supabase
2. Restore from backup created by migration script
3. Checkout main branch and redeploy

## Breaking Changes

⚠️ **This is a breaking change requiring data migration**

- All UUIDs are converted to ULIDs
- Database moves from Supabase to Turso
- New environment variables required: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- Old environment variables removed: `POSTGRES_URL`

## Performance Impact

**Expected improvements:**

- ✅ Faster queries with ULID-ordered indexes
- ✅ Lower latency with edge replication
- ✅ Reduced costs (no connection pooling needed)
- ✅ Better scalability with serverless architecture

## Security Considerations

- ULID generation uses cryptographically secure randomness
- Turso connections use TLS with auth tokens
- Migration script validates all relationships and constraints
- Backup created before migration for safety

## Related Issues

Closes #[issue number if applicable]

## Additional Notes

- R2 storage migration will be handled in a separate PR/branch
- Migration script keeps `postgres` dependency for reading Supabase data
- All existing Supabase data is preserved in backup files
- ULID format is compatible with existing string-based ID fields

---

**Deployment Timeline:**

1. Merge to main after testing
2. Set up production Turso database
3. Run migration during maintenance window
4. Verify production functionality
5. Monitor for issues
6. Decommission Supabase instance (after confirmation period)
