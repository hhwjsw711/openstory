-- Migration: Remove unused database functions
-- Description: Drop functions that have been moved to TypeScript or are no longer needed
-- Date: 2025-10-22

-- Functions moved to TypeScript application code:

-- 1. migrate_anonymous_user_data - Moved to src/lib/auth/migrate-user-data.ts
DROP FUNCTION IF EXISTS migrate_anonymous_user_data(uuid, uuid);

-- 2. increment_style_usage - Replaced with direct UPDATE in src/lib/style-stack/service.ts
DROP FUNCTION IF EXISTS increment_style_usage(uuid);

-- Unused functions (never called):

-- 3. create_style_version - Not used anywhere in the application
DROP FUNCTION IF EXISTS create_style_version(uuid, varchar, text, jsonb, uuid);

-- 4. cleanup_expired_anonymous_sessions - References non-existent anonymous_sessions table
DROP FUNCTION IF EXISTS cleanup_expired_anonymous_sessions();

-- 5. cleanup_expired_auth_data - Defined but never scheduled or called
DROP FUNCTION IF EXISTS cleanup_expired_auth_data();

-- 6. expire_old_invitations - Defined but never scheduled or called
DROP FUNCTION IF EXISTS expire_old_invitations();

-- 7. create_team_for_new_user - Defined but no trigger uses it
DROP FUNCTION IF EXISTS create_team_for_new_user();

-- 8. create_default_team_for_user - Already dropped in migration 20250923000003_better_auth_setup.sql
DROP FUNCTION IF EXISTS create_default_team_for_user();

-- Note: Keeping all trigger-based functions for auto-updating timestamps:
-- - update_updated_at_column()
-- - update_betterauth_updated_at_column()
-- - update_letzai_requests_updated_at()
-- - sync_betterauth_to_users() (critical for BetterAuth integration)
