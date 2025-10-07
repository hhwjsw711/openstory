-- BetterAuth database schema migration
-- Creates standard BetterAuth tables using default names with UUID support

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

