# Migration Steps: Supabase → Turso + UUID → ULID

This document outlines the steps to migrate from Supabase (PostgreSQL + UUID) to Turso (SQLite + ULID).

## Prerequisites

1. **Turso Account & Database**

   ```bash
   # Install Turso CLI
   curl -sSfL https://get.tur.so/install.sh | bash

   # Login to Turso
   turso auth login

   # Create database
   turso db create velro-production

   # Get database URL and auth token
   turso db show velro-production --url
   turso db tokens create velro-production
   ```

2. **Environment Variables**

   Update your `.env.local` or `.env.production` with:

   ```bash
   # Turso Database
   TURSO_DATABASE_URL="libsql://your-database.turso.io"
   TURSO_AUTH_TOKEN="your-auth-token"

   # Better Auth (update these)
   BETTER_AUTH_SECRET="your-secret"
   BETTER_AUTH_URL="https://your-app.com"

   # Keep Supabase for migration script
   POSTGRES_URL="postgresql://..."
   ```

## Migration Process

### Step 1: Install Dependencies

```bash
bun install
```

This will install the new dependencies:

- `@libsql/client` - Turso/libSQL database client
- `ulid` - ULID generation library

### Step 2: Generate Drizzle Migrations

```bash
bun db:generate
```

This creates the SQLite migration files in `drizzle/migrations/` based on the updated schema.

### Step 3: Apply Migrations to Turso

```bash
bun db:push
```

This creates all tables in your Turso database.

### Step 4: Backup Supabase Data (Optional but Recommended)

```bash
bun scripts/migrate-supabase-to-turso.ts --dry-run --backup
```

This creates a JSON backup of all your Supabase data in `backups/` without making any changes.

### Step 5: Migrate Data

**Dry Run First:**

```bash
bun scripts/migrate-supabase-to-turso.ts --dry-run
```

Review the output to ensure everything looks correct.

**Actual Migration:**

```bash
bun scripts/migrate-supabase-to-turso.ts --backup
```

This will:

- Create a backup of your Supabase data
- Migrate all data to Turso
- Convert all UUIDs to ULIDs
- Preserve all relationships

### Step 6: Verify Migration

1. **Check data integrity:**

   ```bash
   bun db:studio
   ```

   Browse your Turso database and verify:
   - All tables have data
   - Row counts match Supabase
   - Relationships are preserved

2. **Test your application:**

   ```bash
   bun dev
   ```

   - Test authentication (login/signup)
   - Test team features
   - Test sequence creation
   - Verify all CRUD operations work

### Step 7: Update Environment Variables

Once verified, update your production environment variables:

1. **Vercel/Production:**
   - Update `TURSO_DATABASE_URL`
   - Update `TURSO_AUTH_TOKEN`
   - Update `BETTER_AUTH_URL`

2. **Remove old Supabase variables:**
   - You can remove `POSTGRES_URL` (unless you want to keep it for rollback)
   - Remove `SUPABASE_*` variables if not using Supabase Storage

### Step 8: Deploy

```bash
git push origin claude/migrate-supabase-to-turso-011CV4e8Nt5KaXcwL9CW2KnD
```

Create a pull request and deploy to production after testing in preview environment.

## Rollback Plan

If you need to rollback:

1. **Restore environment variables** to use Supabase
2. **Keep the backup** created in Step 4
3. **Revert code changes** by checking out main branch

## Migration Script Reference

The migration script (`scripts/migrate-supabase-to-turso.ts`) handles:

### Tables Migrated

- **Auth:** `user`, `session`, `account`, `verification`
- **Teams:** `teams`, `team_members`, `team_invitations`
- **Content:** `sequences`, `frames`
- **Libraries:** `styles`, `style_adaptations`, `characters`, `vfx`, `audio`
- **Tracking:** `user_credits`, `credit_transactions`, `fal_requests`, `letzai_requests`, `audit_logs`

### Data Transformations

- **UUID → ULID:** All primary and foreign keys
- **Timestamps:** PostgreSQL `timestamp with timezone` → SQLite `integer` (Unix timestamp)
- **Booleans:** PostgreSQL `boolean` → SQLite `integer` (0/1)
- **JSON:** PostgreSQL `jsonb` → SQLite `text` (JSON string)
- **Arrays:** PostgreSQL `array` → SQLite `text` (JSON array string)

### Validation

The script maintains referential integrity by:

1. Creating a UUID → ULID mapping
2. Migrating tables in dependency order
3. Using the same ULID for related records

## Troubleshooting

### "Missing required environment variable"

Ensure all environment variables are set in your `.env.local` file.

### "Migration failed: foreign key constraint"

The script migrates tables in the correct order. If you see this error, check:

1. Are all source tables accessible?
2. Are all target tables created?

### "Duplicate entry" errors

If running multiple times, you may need to clear Turso database first:

```bash
turso db shell velro-production
sqlite> DELETE FROM user; -- Repeat for all tables
```

Or recreate the database:

```bash
turso db destroy velro-production
turso db create velro-production
bun db:push
```

### Performance Issues

For large datasets:

1. Run migration script on a server close to both databases
2. Consider batching inserts (modify script to use transactions)
3. Disable foreign key constraints during migration (re-enable after)

## Post-Migration

After successful migration:

1. **Monitor performance:**
   - Check query performance in production
   - Monitor Turso usage/costs
   - Watch for any errors in logs

2. **Update documentation:**
   - Update README with Turso setup
   - Document new environment variables
   - Update deployment guides

3. **Clean up:**
   - Archive Supabase backups
   - Consider decommissioning Supabase instance
   - Remove unused environment variables

## Questions?

If you encounter issues:

1. Check the migration script logs
2. Review the backup files
3. Verify environment variables
4. Test in development first
