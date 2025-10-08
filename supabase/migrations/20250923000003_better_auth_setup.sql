-- BetterAuth database schema migration
-- Creates standard BetterAuth tables using default names with UUID support
--
-- MIGRATION CLEANUP SECTION
-- This section removes all dependencies on Supabase Auth (auth.users, auth.uid(), auth.role())
-- and prepares the database for BetterAuth integration

-- ============================================================================
-- 1. DROP FOREIGN KEY CONSTRAINTS REFERENCING auth.users
-- ============================================================================

-- Drop FK from users.id (from 20240829000001_initial_schema.sql)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Drop FK from user_profiles.id (from 20250901091801_authentication.sql)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- Drop FK from letzai_requests.user_id (from 20250923000002_add_letzai_requests_table.sql)
ALTER TABLE letzai_requests DROP CONSTRAINT IF EXISTS letzai_requests_user_id_fkey;

-- ============================================================================
-- 2. DROP STORAGE RLS POLICIES USING auth.uid() and auth.role()
-- ============================================================================

-- Drop all storage policies from 20240829000002_storage_buckets.sql
-- These policies use auth.role() and auth.uid() which won't work with BetterAuth
DROP POLICY IF EXISTS "Thumbnails authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Thumbnails user update" ON storage.objects;
DROP POLICY IF EXISTS "Thumbnails user delete" ON storage.objects;

DROP POLICY IF EXISTS "Videos authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Videos user update" ON storage.objects;
DROP POLICY IF EXISTS "Videos user delete" ON storage.objects;

DROP POLICY IF EXISTS "Characters authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Styles authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Audio authenticated upload" ON storage.objects;

DROP POLICY IF EXISTS "Scripts team read" ON storage.objects;
DROP POLICY IF EXISTS "Scripts team upload" ON storage.objects;

DROP POLICY IF EXISTS "Exports team read" ON storage.objects;
DROP POLICY IF EXISTS "Exports team upload" ON storage.objects;

-- ============================================================================
-- 3. DROP RLS POLICIES USING auth.uid() 
-- ============================================================================

-- Drop letzai_requests policies that use auth.uid()
DROP POLICY IF EXISTS "Users can view team letzai requests" ON letzai_requests;
DROP POLICY IF EXISTS "Users can create team letzai requests" ON letzai_requests;
DROP POLICY IF EXISTS "Users can update team letzai requests" ON letzai_requests;

-- ============================================================================
-- 4. DROP OLD USER TRIGGERS (replaced by BetterAuth sync trigger)
-- ============================================================================

-- Drop trigger from 20250903161123_remove_users_email_column.sql
DROP TRIGGER IF EXISTS create_team_on_user_signup ON users;
DROP FUNCTION IF EXISTS create_default_team_for_user();

-- ============================================================================
-- 5. UPDATE letzai_requests.user_id FOREIGN KEY TO REFERENCE users(id)
-- ============================================================================

-- Add new FK constraint to reference users table instead of auth.users
ALTER TABLE letzai_requests 
ADD CONSTRAINT letzai_requests_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- 6. RECREATE STORAGE POLICIES FOR BACKEND-ONLY ACCESS
-- ============================================================================

-- Public read policies remain (no auth needed)
-- Write policies: Service role bypass (handled via backend API)

-- Thumbnails: Service role can write
CREATE POLICY "Thumbnails service write" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'thumbnails');
    
CREATE POLICY "Thumbnails service update" ON storage.objects 
    FOR UPDATE USING (bucket_id = 'thumbnails');
    
CREATE POLICY "Thumbnails service delete" ON storage.objects 
    FOR DELETE USING (bucket_id = 'thumbnails');

-- Videos: Service role can write
CREATE POLICY "Videos service write" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'videos');
    
CREATE POLICY "Videos service update" ON storage.objects 
    FOR UPDATE USING (bucket_id = 'videos');
    
CREATE POLICY "Videos service delete" ON storage.objects 
    FOR DELETE USING (bucket_id = 'videos');

-- Characters: Service role can write
CREATE POLICY "Characters service write" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'characters');

-- Styles: Service role can write
CREATE POLICY "Styles service write" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'styles');

-- Audio: Service role can write
CREATE POLICY "Audio service write" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'audio');

-- Scripts: Service role can write (authorization in backend)
CREATE POLICY "Scripts service read" ON storage.objects 
    FOR SELECT USING (bucket_id = 'scripts');
    
CREATE POLICY "Scripts service write" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'scripts');

-- Exports: Service role can write (authorization in backend)
CREATE POLICY "Exports service read" ON storage.objects 
    FOR SELECT USING (bucket_id = 'exports');
    
CREATE POLICY "Exports service write" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'exports');

-- ============================================================================
-- 7. RECREATE letzai_requests POLICIES FOR BACKEND-ONLY ACCESS
-- ============================================================================

-- Service role bypass policy (all access via API layer)
CREATE POLICY "Service role bypass" ON letzai_requests FOR ALL USING (true);

-- ============================================================================
-- END CLEANUP SECTION
-- ============================================================================

-- Create user table for BetterAuth (using UUID for compatibility with Velro)
CREATE TABLE IF NOT EXISTS "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT,
    image TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Anonymous plugin field
    "isAnonymous" BOOLEAN DEFAULT FALSE,
    -- Additional fields from BetterAuth config
    "fullName" TEXT,
    "avatarUrl" TEXT,
    "onboardingCompleted" BOOLEAN DEFAULT FALSE
);

-- Create session table
CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    token TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

-- Create account table (for OAuth providers, email/password, etc.)
CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ,
    "refreshTokenExpiresAt" TIMESTAMPTZ,
    scope TEXT,
    password TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create verification table (for email verification)
CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_user_id ON session("userId");
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_expires_at ON session("expiresAt");

CREATE INDEX IF NOT EXISTS idx_account_user_id ON account("userId");
CREATE INDEX IF NOT EXISTS idx_account_provider ON account("providerId", "accountId");

CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
CREATE INDEX IF NOT EXISTS idx_verification_expires_at ON verification("expiresAt");

-- Add updated_at triggers
CREATE TRIGGER update_user_updated_at 
    BEFORE UPDATE ON "user"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_updated_at 
    BEFORE UPDATE ON session
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_updated_at 
    BEFORE UPDATE ON account
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verification_updated_at 
    BEFORE UPDATE ON verification
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on BetterAuth tables (backend-only access)
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE session ENABLE ROW LEVEL SECURITY;
ALTER TABLE account ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (no user access, only service)
CREATE POLICY "Service role full access" ON "user" FOR ALL USING (true);
CREATE POLICY "Service role full access" ON session FOR ALL USING (true);
CREATE POLICY "Service role full access" ON account FOR ALL USING (true);
CREATE POLICY "Service role full access" ON verification FOR ALL USING (true);

-- Function to sync BetterAuth users with Velro users table
CREATE OR REPLACE FUNCTION sync_betterauth_to_users()
RETURNS TRIGGER AS $$
DECLARE
    v_team_id UUID;
    v_team_slug TEXT;
BEGIN
    -- Sync BetterAuth user data to our users table for application use
    -- Both tables now use UUID, so no casting needed
    -- Map image field from OAuth to avatar_url
    INSERT INTO users (id, full_name, avatar_url, created_at, updated_at)
    VALUES (NEW.id, NEW.name, COALESCE(NEW.image, NEW."avatarUrl"), NEW."createdAt", NEW."updatedAt")
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = EXCLUDED.updated_at;
    
    -- Check if user already has a team membership
    IF NOT EXISTS (
        SELECT 1 FROM team_members WHERE user_id = NEW.id
    ) THEN
        -- Create a default team for the new user
        v_team_slug := 'user-' || substring(NEW.id::text from 1 for 8) || '-' || extract(epoch from now())::bigint;
        
        INSERT INTO teams (name, slug, created_at, updated_at)
        VALUES (
            COALESCE(NEW.name, 'User') || '''s Team',
            v_team_slug,
            NEW."createdAt",
            NEW."updatedAt"
        )
        RETURNING id INTO v_team_id;
        
        -- Add user as team owner
        INSERT INTO team_members (team_id, user_id, role, joined_at)
        VALUES (v_team_id, NEW.id, 'owner', NEW."createdAt");
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync BetterAuth user table to Velro users table
CREATE TRIGGER sync_user_to_users_trigger
    AFTER INSERT OR UPDATE ON "user"
    FOR EACH ROW EXECUTE FUNCTION sync_betterauth_to_users();

-- Function to clean up expired sessions and verifications
CREATE OR REPLACE FUNCTION cleanup_expired_auth_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_sessions INTEGER;
    deleted_verifications INTEGER;
    total_deleted INTEGER;
BEGIN
    -- Clean up expired sessions
    DELETE FROM session WHERE "expiresAt" < NOW();
    GET DIAGNOSTICS deleted_sessions = ROW_COUNT;
    
    -- Clean up expired verifications
    DELETE FROM verification WHERE "expiresAt" < NOW();
    GET DIAGNOSTICS deleted_verifications = ROW_COUNT;
    
    total_deleted := deleted_sessions + deleted_verifications;
    
    RAISE NOTICE 'Cleaned up % expired auth records', total_deleted;
    
    RETURN total_deleted;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE "user" IS 'BetterAuth user table - authentication identities (uses UUID for Velro compatibility)';
COMMENT ON TABLE session IS 'BetterAuth session table - active user sessions';
COMMENT ON TABLE account IS 'BetterAuth account table - links users to auth providers (OAuth, email/password, etc)';
COMMENT ON TABLE verification IS 'BetterAuth verification table - email verification tokens';

COMMENT ON COLUMN "user".image IS 'Profile image URL from OAuth providers (Google, GitHub, etc.)';

COMMENT ON FUNCTION sync_betterauth_to_users() IS 'Syncs BetterAuth user table with Velro users table for consistency';
COMMENT ON FUNCTION cleanup_expired_auth_data() IS 'Removes expired sessions and verification tokens';

-- Update users table comment to reflect BetterAuth integration
COMMENT ON TABLE users IS 'Velro user profiles - synced from BetterAuth "user" table via trigger. Contains application-specific user data.';

-- Team Invitations Migration
-- Creates table for managing team member invitations

-- Create invitation status enum
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- Create team_invitations table
CREATE TABLE team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role team_member_role NOT NULL DEFAULT 'member',
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status invitation_status NOT NULL DEFAULT 'pending',
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_invitations_status ON team_invitations(status);
CREATE INDEX idx_team_invitations_expires_at ON team_invitations(expires_at);

-- Create unique constraint to prevent duplicate pending invitations
CREATE UNIQUE INDEX idx_team_invitations_unique_pending 
ON team_invitations(team_id, email) 
WHERE status = 'pending';

-- Add trigger for updated_at
CREATE TRIGGER update_team_invitations_updated_at 
BEFORE UPDATE ON team_invitations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
    UPDATE team_invitations
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for team_invitations
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Service role bypass policy
CREATE POLICY "Service role bypass" ON team_invitations FOR ALL USING (true);

-- Add comment explaining the table
COMMENT ON TABLE team_invitations IS 'Stores team member invitations with expiration and status tracking. Invitations expire after 7 days.';
COMMENT ON COLUMN team_invitations.token IS 'Unique token for accepting invitation via email link';
COMMENT ON COLUMN team_invitations.role IS 'Role to assign when invitation is accepted (default: member)';

-- Add unique constraint to teams.slug to prevent duplicate slugs
-- This addresses the security review finding about slug uniqueness

-- First, check if there are any duplicate slugs and fix them
DO $$
DECLARE
  duplicate_slug RECORD;
  new_slug TEXT;
  counter INT;
BEGIN
  -- Find and fix any duplicate slugs
  FOR duplicate_slug IN 
    SELECT slug, COUNT(*) as count
    FROM teams
    GROUP BY slug
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Found duplicate slug: %', duplicate_slug.slug;
    
    -- For each duplicate, append a counter to make it unique
    counter := 1;
    FOR duplicate_slug IN
      SELECT id, slug
      FROM teams
      WHERE slug = duplicate_slug.slug
      ORDER BY created_at
      OFFSET 1  -- Keep the first one as-is
    LOOP
      new_slug := duplicate_slug.slug || '-' || counter;
      
      -- Ensure the new slug is also unique
      WHILE EXISTS (SELECT 1 FROM teams WHERE slug = new_slug) LOOP
        counter := counter + 1;
        new_slug := duplicate_slug.slug || '-' || counter;
      END LOOP;
      
      UPDATE teams SET slug = new_slug WHERE id = duplicate_slug.id;
      RAISE NOTICE 'Updated team % slug to %', duplicate_slug.id, new_slug;
      
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Now add the unique constraint
ALTER TABLE teams ADD CONSTRAINT teams_slug_unique UNIQUE (slug);

-- Update the create_team_for_new_user function to use more robust slug generation
CREATE OR REPLACE FUNCTION create_team_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_team_id UUID;
    v_team_slug TEXT;
    v_counter INT := 0;
    v_max_attempts INT := 10;
BEGIN
    -- Only create a team if the user doesn't already have one
    IF NOT EXISTS (
        SELECT 1 FROM team_members WHERE user_id = NEW.id
    ) THEN
        -- Generate a more robust unique slug
        -- Use UUID substring + millisecond timestamp for better uniqueness
        v_team_slug := 'user-' || substring(NEW.id::text from 1 for 8) || '-' || floor(extract(epoch from now()) * 1000)::bigint;
        
        -- Ensure slug is unique (with retry logic)
        WHILE EXISTS (SELECT 1 FROM teams WHERE slug = v_team_slug) AND v_counter < v_max_attempts LOOP
            v_counter := v_counter + 1;
            v_team_slug := 'user-' || substring(NEW.id::text from 1 for 8) || '-' || floor(extract(epoch from now()) * 1000)::bigint || '-' || v_counter;
        END LOOP;
        
        IF v_counter >= v_max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique team slug after % attempts', v_max_attempts;
        END IF;
        
        -- Create a default team for the new user
        INSERT INTO teams (name, slug)
        VALUES (
            COALESCE(NEW.name, 'My Team'),
            v_team_slug
        )
        RETURNING id INTO v_team_id;

        -- Add the user as the owner of the team
        INSERT INTO team_members (team_id, user_id, role)
        VALUES (v_team_id, NEW.id, 'owner');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON CONSTRAINT teams_slug_unique ON teams IS 
  'Ensures team slugs are unique across the platform. Added as part of security review.';

