-- Authentication system migration
-- Creates user_profiles and anonymous_sessions tables for the authentication system

-- 1. User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id VARCHAR(36) UNIQUE,
  full_name VARCHAR(255),
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Anonymous sessions
CREATE TABLE IF NOT EXISTS anonymous_sessions (
  id VARCHAR(36) PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  data JSONB DEFAULT '{}', -- Temporary work storage
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_anonymous_id ON user_profiles(anonymous_id);
CREATE INDEX idx_anonymous_sessions_expires ON anonymous_sessions(expires_at);
CREATE INDEX idx_anonymous_sessions_team_id ON anonymous_sessions(team_id);

-- Add trigger for updated_at on user_profiles
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_sessions ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies for API access
CREATE POLICY "Service role bypass" ON user_profiles FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON anonymous_sessions FOR ALL USING (true);

-- Cleanup expired anonymous sessions (run daily)
-- This will be used by a scheduled job later
CREATE OR REPLACE FUNCTION cleanup_expired_anonymous_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM anonymous_sessions 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;