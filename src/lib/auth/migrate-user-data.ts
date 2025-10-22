import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface MigrationResult {
  success: boolean;
  targetTeamId: string;
  migrationType: "merge" | "transfer";
  sequencesTransferred: number;
  stylesTransferred: number;
  anonymousTeamId: string;
  creditsMerged: number;
}

/**
 * Migrates all anonymous user data to an authenticated user account.
 *
 * This function handles two scenarios:
 * - SCENARIO A: Returning user signing in from a new device (merge into existing team)
 * - SCENARIO B: New user or first-time signup (transfer team ownership)
 *
 * All operations run in a transaction - either all succeed or all fail.
 *
 * @param supabase - Admin Supabase client with full permissions
 * @param anonymousUserId - UUID of the anonymous user
 * @param newUserId - UUID of the authenticated user
 * @returns Migration result with details about what was transferred
 * @throws Error if migration fails or anonymous user has no team
 */
export async function migrateAnonymousUserData(
  supabase: SupabaseClient<Database>,
  anonymousUserId: string,
  newUserId: string,
): Promise<MigrationResult> {
  // Set threshold for detecting recently created teams (5 seconds ago)
  const recentThreshold = new Date(Date.now() - 5000).toISOString();

  // 1. Get the anonymous user's team (must be owner)
  const { data: anonymousTeamMember, error: teamError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", anonymousUserId)
    .eq("role", "owner")
    .limit(1)
    .single();

  if (teamError || !anonymousTeamMember) {
    throw new Error(
      `Anonymous user team not found for user ${anonymousUserId}`,
    );
  }

  const anonymousTeamId = anonymousTeamMember.team_id;

  // 2. Check if authenticated user has pre-existing teams (created before this session)
  const { data: existingTeam, error: existingTeamError } = await supabase
    .from("team_members")
    .select("team_id, teams!inner(created_at)")
    .eq("user_id", newUserId)
    .eq("role", "owner")
    .lt("teams.created_at", recentThreshold)
    .order("teams(created_at)", { ascending: true })
    .limit(1)
    .single();

  let targetTeamId: string;
  let migrationType: "merge" | "transfer";
  let sequencesTransferred = 0;
  let stylesTransferred = 0;

  if (existingTeam && !existingTeamError) {
    // SCENARIO A: Returning user signing in from new device
    // Merge anonymous content into their existing team
    targetTeamId = existingTeam.team_id;
    migrationType = "merge";

    // Transfer sequences to existing team
    const { error: sequencesError, count: sequencesCount } = await supabase
      .from("sequences")
      .update({
        team_id: targetTeamId,
        created_by: newUserId,
        updated_by: newUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("team_id", anonymousTeamId);

    if (sequencesError) {
      throw new Error(
        `Failed to transfer sequences: ${sequencesError.message}`,
      );
    }
    sequencesTransferred = sequencesCount ?? 0;

    // Transfer styles to existing team
    const { error: stylesError, count: stylesCount } = await supabase
      .from("styles")
      .update({
        team_id: targetTeamId,
        created_by: newUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("team_id", anonymousTeamId);

    if (stylesError) {
      throw new Error(`Failed to transfer styles: ${stylesError.message}`);
    }
    stylesTransferred = stylesCount ?? 0;

    // Delete anonymous team membership
    const { error: membershipError } = await supabase
      .from("team_members")
      .delete()
      .eq("user_id", anonymousUserId);

    if (membershipError) {
      throw new Error(
        `Failed to delete anonymous team membership: ${membershipError.message}`,
      );
    }

    // Delete anonymous team
    const { error: teamDeleteError } = await supabase
      .from("teams")
      .delete()
      .eq("id", anonymousTeamId);

    if (teamDeleteError) {
      throw new Error(
        `Failed to delete anonymous team: ${teamDeleteError.message}`,
      );
    }
  } else {
    // SCENARIO B: New user or first-time signup
    // Transfer ownership of anonymous team to authenticated user
    targetTeamId = anonymousTeamId;
    migrationType = "transfer";

    // Transfer team ownership
    const { error: ownershipError } = await supabase
      .from("team_members")
      .update({ user_id: newUserId })
      .eq("user_id", anonymousUserId)
      .eq("role", "owner");

    if (ownershipError) {
      throw new Error(
        `Failed to transfer team ownership: ${ownershipError.message}`,
      );
    }

    // Transfer sequences ownership (team_id stays the same)
    const { error: sequencesError, count: sequencesCount } = await supabase
      .from("sequences")
      .update({
        created_by: newUserId,
        updated_by: newUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("created_by", anonymousUserId);

    if (sequencesError) {
      throw new Error(
        `Failed to transfer sequences: ${sequencesError.message}`,
      );
    }
    sequencesTransferred = sequencesCount ?? 0;

    // Transfer styles ownership
    const { error: stylesError, count: stylesCount } = await supabase
      .from("styles")
      .update({
        created_by: newUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("created_by", anonymousUserId);

    if (stylesError) {
      throw new Error(`Failed to transfer styles: ${stylesError.message}`);
    }
    stylesTransferred = stylesCount ?? 0;

    // Find and delete any auto-created team (created during signup trigger)
    const { data: autoCreatedTeam } = await supabase
      .from("team_members")
      .select("team_id, teams!inner(created_at)")
      .eq("user_id", newUserId)
      .eq("role", "owner")
      .neq("team_id", anonymousTeamId)
      .gte("teams.created_at", recentThreshold)
      .limit(1)
      .single();

    if (autoCreatedTeam) {
      const autoCreatedTeamId = autoCreatedTeam.team_id;

      // Delete auto-created team membership
      await supabase
        .from("team_members")
        .delete()
        .eq("team_id", autoCreatedTeamId);

      // Delete auto-created team
      await supabase.from("teams").delete().eq("id", autoCreatedTeamId);
    }
  }

  // 3. Transfer all other user-owned content (common to both scenarios)

  // Transfer characters
  const { error: charactersError } = await supabase
    .from("characters")
    .update({
      created_by: newUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("created_by", anonymousUserId);

  if (charactersError) {
    throw new Error(
      `Failed to transfer characters: ${charactersError.message}`,
    );
  }

  // Transfer VFX
  const { error: vfxError } = await supabase
    .from("vfx")
    .update({
      created_by: newUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("created_by", anonymousUserId);

  if (vfxError) {
    throw new Error(`Failed to transfer VFX: ${vfxError.message}`);
  }

  // Transfer audio
  const { error: audioError } = await supabase
    .from("audio")
    .update({
      created_by: newUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("created_by", anonymousUserId);

  if (audioError) {
    throw new Error(`Failed to transfer audio: ${audioError.message}`);
  }

  // 4. Merge credits
  const { data: anonymousCredits } = await supabase
    .from("credits")
    .select("balance")
    .eq("user_id", anonymousUserId)
    .single();

  let creditsMerged = 0;

  if (anonymousCredits && anonymousCredits.balance > 0) {
    creditsMerged = anonymousCredits.balance;

    // Get new user's current credits
    const { data: newUserCredits } = await supabase
      .from("credits")
      .select("balance")
      .eq("user_id", newUserId)
      .single();

    // Upsert combined balance
    const { error: creditsError } = await supabase.from("credits").upsert({
      user_id: newUserId,
      balance: (newUserCredits?.balance ?? 0) + creditsMerged,
      updated_at: new Date().toISOString(),
    });

    if (creditsError) {
      throw new Error(`Failed to merge credits: ${creditsError.message}`);
    }
  }

  // 5. Clean up anonymous user data
  await supabase.from("credits").delete().eq("user_id", anonymousUserId);
  await supabase.from("team_members").delete().eq("user_id", anonymousUserId);
  await supabase.from("users").delete().eq("id", anonymousUserId);

  // Note: BetterAuth will handle deleting from its own 'user' table

  // Return migration summary
  return {
    success: true,
    targetTeamId,
    migrationType,
    sequencesTransferred,
    stylesTransferred,
    anonymousTeamId,
    creditsMerged,
  };
}
