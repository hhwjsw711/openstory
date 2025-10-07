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

