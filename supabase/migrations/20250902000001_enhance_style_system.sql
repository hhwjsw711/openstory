-- Enhance the styles table to match GitHub issue requirements
-- This migration transforms the existing basic styles table into a comprehensive Style Stack system

-- First, drop the existing simple styles table
DROP TABLE IF EXISTS styles CASCADE;

-- Create enhanced styles table
CREATE TABLE styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}', -- The Style Stack JSON configuration
    category VARCHAR(100), -- e.g., 'cinematic', 'artistic', 'documentary'
    tags TEXT[] DEFAULT '{}', -- Array of tags for categorization
    is_public BOOLEAN DEFAULT false, -- Whether style is visible to other teams
    is_template BOOLEAN DEFAULT false, -- Whether this is a default template
    version INTEGER DEFAULT 1, -- Version number for style versioning
    parent_id UUID REFERENCES styles(id) ON DELETE SET NULL, -- For versioning/forking
    preview_url TEXT, -- URL to preview image
    usage_count INTEGER DEFAULT 0, -- Track how often this style is used
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create style_adaptations table for model-specific configurations
CREATE TABLE style_adaptations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    style_id UUID NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
    model_provider VARCHAR(100) NOT NULL, -- e.g., 'fal', 'runway', 'kling'
    model_name VARCHAR(100) NOT NULL, -- e.g., 'flux-pro', 'imagen4'
    adapted_config JSONB NOT NULL DEFAULT '{}', -- Model-specific adaptations
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX idx_styles_team_id ON styles(team_id);
CREATE INDEX idx_styles_is_public ON styles(is_public);
CREATE INDEX idx_styles_is_template ON styles(is_template);
CREATE INDEX idx_styles_category ON styles(category);
CREATE INDEX idx_styles_name_gin ON styles USING gin(name gin_trgm_ops);
CREATE INDEX idx_styles_tags_gin ON styles USING gin(tags);
CREATE INDEX idx_styles_usage_count ON styles(usage_count DESC);
CREATE INDEX idx_styles_created_at ON styles(created_at DESC);
CREATE INDEX idx_styles_parent_id ON styles(parent_id);

CREATE INDEX idx_style_adaptations_style_id ON style_adaptations(style_id);
CREATE INDEX idx_style_adaptations_provider_model ON style_adaptations(model_provider, model_name);

-- Add updated_at trigger for styles table
CREATE TRIGGER update_styles_updated_at BEFORE UPDATE ON styles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for styles and style_adaptations
ALTER TABLE styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_adaptations ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies
CREATE POLICY "Service role bypass" ON styles FOR ALL USING (true);
CREATE POLICY "Service role bypass" ON style_adaptations FOR ALL USING (true);

-- Function to increment usage count when a style is applied
CREATE OR REPLACE FUNCTION increment_style_usage(style_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE styles 
    SET usage_count = usage_count + 1 
    WHERE id = style_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to create a style version (fork)
CREATE OR REPLACE FUNCTION create_style_version(
    original_style_id UUID,
    new_name VARCHAR(255),
    new_description TEXT,
    new_config JSONB,
    creator_id UUID
)
RETURNS UUID AS $$
DECLARE
    new_style_id UUID;
    original_style RECORD;
BEGIN
    -- Get original style info
    SELECT team_id, category, tags, is_public 
    INTO original_style 
    FROM styles 
    WHERE id = original_style_id;
    
    -- Create new version
    INSERT INTO styles (
        team_id,
        name,
        description,
        config,
        category,
        tags,
        is_public,
        parent_id,
        version,
        created_by
    )
    VALUES (
        original_style.team_id,
        new_name,
        new_description,
        new_config,
        original_style.category,
        original_style.tags,
        original_style.is_public,
        original_style_id,
        (SELECT COALESCE(MAX(version), 0) + 1 FROM styles WHERE parent_id = original_style_id OR id = original_style_id),
        creator_id
    )
    RETURNING id INTO new_style_id;
    
    RETURN new_style_id;
END;
$$ LANGUAGE plpgsql;