-- Migration: Update migrate_anonymous_user_data to remove jobs table reference
-- Description: Remove jobs table migration code since we've moved to QStash Workflow
-- Date: 2025-10-22

CREATE OR REPLACE FUNCTION migrate_anonymous_user_data(
  p_anonymous_user_id uuid,
  p_new_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_anonymous_team_id uuid;
  v_existing_user_team_id uuid;
  v_target_team_id uuid;
  v_auto_created_team_id uuid;
  v_anonymous_credits int;
  v_new_user_credits int;
  v_recent_threshold timestamptz;
  v_result jsonb;
  v_sequences_transferred int;
  v_styles_transferred int;
BEGIN
  -- Set threshold for detecting recently created teams (5 seconds ago)
  v_recent_threshold := now() - interval '5 seconds';

  -- 1. Get the anonymous user's team (must be owner)
  SELECT team_id INTO v_anonymous_team_id
  FROM team_members
  WHERE user_id = p_anonymous_user_id
    AND role = 'owner'
  LIMIT 1;

  IF v_anonymous_team_id IS NULL THEN
    RAISE EXCEPTION 'Anonymous user team not found for user %', p_anonymous_user_id;
  END IF;

  -- 2. Check if authenticated user has pre-existing teams (created before this session)
  SELECT team_id INTO v_existing_user_team_id
  FROM team_members tm
  JOIN teams t ON t.id = tm.team_id
  WHERE tm.user_id = p_new_user_id
    AND tm.role = 'owner'
    AND t.created_at < v_recent_threshold
  ORDER BY t.created_at ASC
  LIMIT 1;

  IF v_existing_user_team_id IS NOT NULL THEN
    -- SCENARIO A: Returning user signing in from new device
    -- Merge anonymous content into their existing team
    v_target_team_id := v_existing_user_team_id;

    -- Transfer sequences to existing team
    UPDATE sequences
    SET team_id = v_target_team_id,
        created_by = p_new_user_id,
        updated_by = p_new_user_id,
        updated_at = now()
    WHERE team_id = v_anonymous_team_id;

    GET DIAGNOSTICS v_sequences_transferred = ROW_COUNT;

    -- Transfer styles to existing team
    UPDATE styles
    SET team_id = v_target_team_id,
        created_by = p_new_user_id,
        updated_at = now()
    WHERE team_id = v_anonymous_team_id;

    GET DIAGNOSTICS v_styles_transferred = ROW_COUNT;

    -- Delete anonymous team membership
    DELETE FROM team_members
    WHERE user_id = p_anonymous_user_id;

    -- Delete anonymous team
    DELETE FROM teams
    WHERE id = v_anonymous_team_id;

  ELSE
    -- SCENARIO B: New user or first-time signup
    -- Transfer ownership of anonymous team to authenticated user
    v_target_team_id := v_anonymous_team_id;

    -- Transfer team ownership
    UPDATE team_members
    SET user_id = p_new_user_id
    WHERE user_id = p_anonymous_user_id
      AND role = 'owner';

    -- Transfer sequences ownership (team_id stays the same)
    UPDATE sequences
    SET created_by = p_new_user_id,
        updated_by = p_new_user_id,
        updated_at = now()
    WHERE created_by = p_anonymous_user_id;

    GET DIAGNOSTICS v_sequences_transferred = ROW_COUNT;

    -- Transfer styles ownership
    UPDATE styles
    SET created_by = p_new_user_id,
        updated_at = now()
    WHERE created_by = p_anonymous_user_id;

    GET DIAGNOSTICS v_styles_transferred = ROW_COUNT;

    -- Find and delete any auto-created team (created during signup trigger)
    SELECT team_id INTO v_auto_created_team_id
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id = p_new_user_id
      AND tm.role = 'owner'
      AND tm.team_id != v_anonymous_team_id
      AND t.created_at >= v_recent_threshold
    LIMIT 1;

    IF v_auto_created_team_id IS NOT NULL THEN
      DELETE FROM team_members
      WHERE team_id = v_auto_created_team_id;

      DELETE FROM teams
      WHERE id = v_auto_created_team_id;
    END IF;
  END IF;

  -- 3. Transfer all other user-owned content (common to both scenarios)

  -- Transfer characters
  UPDATE characters
  SET created_by = p_new_user_id,
      updated_at = now()
  WHERE created_by = p_anonymous_user_id;

  -- Transfer VFX
  UPDATE vfx
  SET created_by = p_new_user_id,
      updated_at = now()
  WHERE created_by = p_anonymous_user_id;

  -- Transfer audio
  UPDATE audio
  SET created_by = p_new_user_id,
      updated_at = now()
  WHERE created_by = p_anonymous_user_id;

  -- NOTE: Removed jobs table migration - we now use QStash Workflow for job management

  -- 4. Merge credits
  SELECT balance INTO v_anonymous_credits
  FROM credits
  WHERE user_id = p_anonymous_user_id;

  IF v_anonymous_credits IS NOT NULL AND v_anonymous_credits > 0 THEN
    -- Get new user's current credits
    SELECT balance INTO v_new_user_credits
    FROM credits
    WHERE user_id = p_new_user_id;

    -- Upsert combined balance
    INSERT INTO credits (user_id, balance, updated_at)
    VALUES (p_new_user_id, COALESCE(v_new_user_credits, 0) + v_anonymous_credits, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance = credits.balance + v_anonymous_credits,
      updated_at = now();
  END IF;

  -- 5. Clean up anonymous user data
  DELETE FROM credits WHERE user_id = p_anonymous_user_id;
  DELETE FROM team_members WHERE user_id = p_anonymous_user_id;
  DELETE FROM users WHERE id = p_anonymous_user_id;

  -- Note: BetterAuth will handle deleting from its own 'user' table

  -- Return migration summary
  v_result := jsonb_build_object(
    'success', true,
    'target_team_id', v_target_team_id,
    'migration_type', CASE WHEN v_existing_user_team_id IS NOT NULL THEN 'merge' ELSE 'transfer' END,
    'sequences_transferred', COALESCE(v_sequences_transferred, 0),
    'styles_transferred', COALESCE(v_styles_transferred, 0),
    'anonymous_team_id', v_anonymous_team_id,
    'credits_merged', COALESCE(v_anonymous_credits, 0)
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise to trigger rollback
    RAISE WARNING 'Migration failed for anonymous user % to user %: %', p_anonymous_user_id, p_new_user_id, SQLERRM;
    RAISE EXCEPTION 'Data migration transaction failed: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION migrate_anonymous_user_data IS
'Atomically migrates all anonymous user data to authenticated user during account linking.
Handles two scenarios: returning users (merge into existing team) and new users (transfer team ownership).
All operations run in a single transaction - failure rolls back all changes.';
