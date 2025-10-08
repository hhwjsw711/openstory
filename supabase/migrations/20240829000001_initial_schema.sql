-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enums
CREATE TYPE team_member_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE sequence_status AS ENUM ('draft', 'processing', 'completed', 'failed', 'archived');
CREATE TYPE transaction_type AS ENUM ('credit_purchase', 'credit_usage', 'credit_refund', 'credit_adjustment');

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index on slug for fast lookups
CREATE INDEX idx_teams_slug ON teams(slug);

-- Users table (independent, synced from BetterAuth)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Team members junction table
CREATE TABLE team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_member_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (team_id, user_id)
);

-- Create indexes for fast lookups
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);

-- Sequences table
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    script TEXT,
    status sequence_status NOT NULL DEFAULT 'draft',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for sequences
CREATE INDEX idx_sequences_team_id ON sequences(team_id);
CREATE INDEX idx_sequences_status ON sequences(status);
CREATE INDEX idx_sequences_created_at ON sequences(created_at DESC);

-- Frames table
CREATE TABLE frames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    description TEXT,
    duration_ms INTEGER DEFAULT 3000,
    thumbnail_url TEXT,
    video_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(sequence_id, order_index)
);

-- Create indexes for frames
CREATE INDEX idx_frames_sequence_id ON frames(sequence_id);
CREATE INDEX idx_frames_order ON frames(sequence_id, order_index);

-- Styles library
CREATE TABLE styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    config_json JSONB NOT NULL DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    preview_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for styles
CREATE INDEX idx_styles_team_id ON styles(team_id);
CREATE INDEX idx_styles_is_public ON styles(is_public);
CREATE INDEX idx_styles_name ON styles(name);

-- Characters library
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    lora_url TEXT,
    config JSONB DEFAULT '{}',
    preview_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for characters
CREATE INDEX idx_characters_team_id ON characters(team_id);
CREATE INDEX idx_characters_name ON characters(name);

-- VFX library
CREATE TABLE vfx (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    preset_config JSONB NOT NULL DEFAULT '{}',
    preview_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for vfx
CREATE INDEX idx_vfx_team_id ON vfx(team_id);
CREATE INDEX idx_vfx_name ON vfx(name);

-- Audio library
CREATE TABLE audio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for audio
CREATE INDEX idx_audio_team_id ON audio(team_id);
CREATE INDEX idx_audio_name ON audio(name);

-- Credits table for user balance
CREATE TABLE credits (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Transactions table for credit history
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    balance_after DECIMAL(10, 2) NOT NULL,
    metadata JSONB DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for transactions
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);

-- Jobs queue table for tracking async tasks
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payload JSONB DEFAULT '{}',
    result JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for jobs
CREATE INDEX idx_jobs_team_id ON jobs(team_id);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequences_updated_at BEFORE UPDATE ON sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_frames_updated_at BEFORE UPDATE ON frames
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_styles_updated_at BEFORE UPDATE ON styles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vfx_updated_at BEFORE UPDATE ON vfx
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audio_updated_at BEFORE UPDATE ON audio
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credits_updated_at BEFORE UPDATE ON credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create a default team for new users
CREATE OR REPLACE FUNCTION create_default_team_for_user()
RETURNS TRIGGER AS $$
DECLARE
    new_team_id UUID;
    team_slug VARCHAR(255);
BEGIN
    -- Generate a unique slug based on user email
    team_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]+', '-', 'g'));
    team_slug := team_slug || '-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 6);
    
    -- Create a new team
    INSERT INTO teams (name, slug)
    VALUES (COALESCE(NEW.full_name, SPLIT_PART(NEW.email, '@', 1)) || '''s Team', team_slug)
    RETURNING id INTO new_team_id;
    
    -- Add the user as owner of the team
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (new_team_id, NEW.id, 'owner');
    
    -- Initialize user credits
    INSERT INTO credits (user_id, balance)
    VALUES (NEW.id, 10.00); -- Start with $10 free credits
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create team for new users
CREATE TRIGGER create_team_on_user_signup
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_default_team_for_user();

-- Add RLS policies (disabled by default as per requirements)
-- Note: We're creating the policies but keeping them disabled
-- They can be enabled later if needed

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE vfx ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create service role bypass policies (allows backend full access)
CREATE POLICY "Service role bypass" ON teams FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON users FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON team_members FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON sequences FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON frames FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON styles FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON characters FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON vfx FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON audio FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON credits FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON transactions FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON jobs FOR ALL USING (true);