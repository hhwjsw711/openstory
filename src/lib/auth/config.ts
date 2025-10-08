/**
 * BetterAuth configuration for Velro
 * Replaces Supabase Auth with anonymous users and email/password login
 */

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { Pool } from "pg";
import { createAdminClient } from "@/lib/supabase/server";

// Environment validation
const requiredEnvVars = {
  DATABASE_URL: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
} as const;

// Validate environment variables
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// Create database connection pool for BetterAuth internal operations
// SSL is enabled automatically when DATABASE_URL includes sslmode=require
const pool = new Pool({
  connectionString: requiredEnvVars.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production",
});

export const auth = betterAuth({
  database: pool,
  secret: requiredEnvVars.BETTER_AUTH_SECRET,
  baseURL: requiredEnvVars.BETTER_AUTH_URL,

  // Session configuration optimized for anonymous users
  session: {
    expiresIn: 60 * 60 * 24 * 365, // 1 year for anonymous users
    updateAge: 60 * 60 * 24, // Update session daily
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5-minute cache
    },
  },

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      console.log("[BetterAuth] Sending password reset email", {
        email: user.email,
        url,
      });

      // Import dynamically to avoid issues during build
      const { sendPasswordResetEmail } = await import("@/lib/email/service");
      const result = await sendPasswordResetEmail(user.email, url);

      if (!result.success) {
        console.error("[BetterAuth] Failed to send reset email:", result.error);
        throw new Error("Failed to send password reset email");
      }

      console.log("[BetterAuth] Password reset email sent successfully");
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour (in seconds)
  },

  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
    },
  },

  // Configure plugins
  plugins: [
    // Anonymous user support with account linking
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        console.log("[BetterAuth] Linking anonymous account", {
          anonymousUserId: anonymousUser.user.id,
          newUserId: newUser.user.id,
        });

        // Transfer anonymous user data to authenticated account using Supabase client
        const supabase = createAdminClient();

        try {
          // 1. Get the anonymous user's team (the one we want to keep)
          // Retry logic to handle race condition with database trigger
          let anonymousTeam = null;
          let retries = 0;
          const maxRetries = 3;

          while (!anonymousTeam && retries < maxRetries) {
            const { data } = await supabase
              .from("team_members")
              .select("team_id")
              .eq("user_id", anonymousUser.user.id)
              .eq("role", "owner")
              .single();

            anonymousTeam = data;

            if (!anonymousTeam && retries < maxRetries - 1) {
              console.warn(
                `[BetterAuth] Anonymous user team not found, retrying... (${retries + 1}/${maxRetries})`,
              );
              // Wait 100ms before retrying
              await new Promise((resolve) => setTimeout(resolve, 100));
              retries++;
            }
          }

          if (!anonymousTeam) {
            throw new Error(
              "Anonymous user team not found after retries. Database trigger may not have completed.",
            );
          }

          // 2. Check if authenticated user already has existing teams (before this session)
          // We need to check for teams that were created BEFORE this login attempt
          const { data: existingUserTeams } = await supabase
            .from("team_members")
            .select("team_id, joined_at, teams!inner(created_at)")
            .eq("user_id", newUser.user.id)
            .eq("role", "owner");

          // Filter out the auto-created team (created in the last few seconds)
          const recentThreshold = new Date(Date.now() - 5000); // 5 seconds ago
          const preExistingTeams =
            existingUserTeams?.filter((tm) => {
              const teamCreatedAt = (tm as { teams: { created_at: string } })
                .teams.created_at;
              return new Date(teamCreatedAt) < recentThreshold;
            }) || [];

          let targetTeamId: string;

          if (preExistingTeams.length > 0) {
            // User has existing teams - this is a RETURNING USER signing in from a new device
            console.log(
              "[BetterAuth] User has existing teams, merging anonymous content",
              { existingTeams: preExistingTeams.length },
            );

            // Use the user's existing team as the target
            targetTeamId = preExistingTeams[0].team_id;

            // Transfer all anonymous team content to the existing team
            const { error: transferTeamError } = await supabase
              .from("sequences")
              .update({ team_id: targetTeamId })
              .eq("team_id", anonymousTeam.team_id);

            if (transferTeamError) {
              console.error(
                "[BetterAuth] Error transferring sequences to existing team:",
                transferTeamError,
              );
            }

            // Transfer styles to existing team
            const { error: transferStylesError } = await supabase
              .from("styles")
              .update({ team_id: targetTeamId })
              .eq("team_id", anonymousTeam.team_id);

            if (transferStylesError) {
              console.error(
                "[BetterAuth] Error transferring styles to existing team:",
                transferStylesError,
              );
            }

            // Delete the anonymous team membership
            await supabase
              .from("team_members")
              .delete()
              .eq("user_id", anonymousUser.user.id);

            // Delete the anonymous team
            await supabase
              .from("teams")
              .delete()
              .eq("id", anonymousTeam.team_id);

            console.log(
              "[BetterAuth] Merged anonymous content into existing team:",
              targetTeamId,
            );
          } else {
            // User is NEW or has no previous teams - transfer anonymous team ownership
            console.log(
              "[BetterAuth] New user, transferring anonymous team ownership",
            );

            targetTeamId = anonymousTeam.team_id;

            // Transfer team ownership from anonymous to authenticated user
            const { error: teamError } = await supabase
              .from("team_members")
              .update({ user_id: newUser.user.id })
              .eq("user_id", anonymousUser.user.id)
              .eq("role", "owner");

            if (teamError) throw teamError;

            // Get the auto-created team (created just now during signup trigger)
            const { data: autoCreatedTeam } = await supabase
              .from("team_members")
              .select("team_id")
              .eq("user_id", newUser.user.id)
              .eq("role", "owner")
              .neq("team_id", anonymousTeam.team_id)
              .single();

            // Delete the auto-created empty team if it exists
            if (autoCreatedTeam) {
              await supabase
                .from("team_members")
                .delete()
                .eq("team_id", autoCreatedTeam.team_id);

              await supabase
                .from("teams")
                .delete()
                .eq("id", autoCreatedTeam.team_id);

              console.log(
                "[BetterAuth] Deleted auto-created team:",
                autoCreatedTeam.team_id,
              );
            }
          }

          // 3. Transfer sequences created by anonymous user to authenticated user
          const { error: sequenceError } = await supabase
            .from("sequences")
            .update({
              created_by: newUser.user.id,
              updated_by: newUser.user.id,
            })
            .eq("created_by", anonymousUser.user.id);

          if (sequenceError) throw sequenceError;

          // 4. Transfer styles
          const { error: stylesError } = await supabase
            .from("styles")
            .update({ created_by: newUser.user.id })
            .eq("created_by", anonymousUser.user.id);

          if (stylesError) throw stylesError;

          // 5. Transfer characters
          const { error: charactersError } = await supabase
            .from("characters")
            .update({ created_by: newUser.user.id })
            .eq("created_by", anonymousUser.user.id);

          if (charactersError) throw charactersError;

          // 6. Transfer VFX
          const { error: vfxError } = await supabase
            .from("vfx")
            .update({ created_by: newUser.user.id })
            .eq("created_by", anonymousUser.user.id);

          if (vfxError) throw vfxError;

          // 7. Transfer audio
          const { error: audioError } = await supabase
            .from("audio")
            .update({ created_by: newUser.user.id })
            .eq("created_by", anonymousUser.user.id);

          if (audioError) throw audioError;

          // 8. Transfer credits (if anonymous user has any)
          const { data: anonymousCredits } = await supabase
            .from("credits")
            .select("balance")
            .eq("user_id", anonymousUser.user.id)
            .single();

          if (anonymousCredits) {
            // Get new user's current credits
            const { data: newUserCredits } = await supabase
              .from("credits")
              .select("balance")
              .eq("user_id", newUser.user.id)
              .single();

            const totalBalance =
              (newUserCredits?.balance || 0) + (anonymousCredits.balance || 0);

            // Upsert the combined balance
            const { error: creditsError } = await supabase
              .from("credits")
              .upsert(
                {
                  user_id: newUser.user.id,
                  balance: totalBalance,
                },
                { onConflict: "user_id" },
              );

            if (creditsError) throw creditsError;
          }

          // 9. Transfer jobs
          const { error: jobsError } = await supabase
            .from("jobs")
            .update({ user_id: newUser.user.id })
            .eq("user_id", anonymousUser.user.id);

          if (jobsError) throw jobsError;

          // 10. Clean up anonymous user data
          const { error: creditsDeleteError } = await supabase
            .from("credits")
            .delete()
            .eq("user_id", anonymousUser.user.id);

          if (creditsDeleteError) {
            console.error(
              "[BetterAuth] Failed to delete anonymous credits:",
              creditsDeleteError,
            );
            // Continue cleanup even if this fails
          }

          const { error: teamMembersDeleteError } = await supabase
            .from("team_members")
            .delete()
            .eq("user_id", anonymousUser.user.id);

          if (teamMembersDeleteError) {
            console.error(
              "[BetterAuth] Failed to delete anonymous team members:",
              teamMembersDeleteError,
            );
            // Continue cleanup even if this fails
          }

          // Delete anonymous user from Velro users table
          const { error: usersDeleteError } = await supabase
            .from("users")
            .delete()
            .eq("id", anonymousUser.user.id);

          if (usersDeleteError) {
            console.error(
              "[BetterAuth] Failed to delete anonymous user:",
              usersDeleteError,
            );
            // Log but don't throw - BetterAuth will clean up its own tables
          }

          // Note: BetterAuth will handle deleting the anonymous user from its 'user' table
          // We clean up our app-specific tables (users, credits, team_members)

          console.log("[BetterAuth] Successfully linked anonymous account");
        } catch (error) {
          console.error(
            "[BetterAuth] Failed to link anonymous account:",
            error,
          );
          throw error;
        }
      },
    }),

    // Next.js cookie integration (must be last)
    nextCookies(),
  ],

  // Custom user fields to match existing schema, This is BetterAuth user table.
  user: {
    additionalFields: {
      fullName: {
        type: "string",
        required: false,
      },
      avatarUrl: {
        type: "string",
        required: false,
      },
      onboardingCompleted: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
  },

  // Advanced configuration
  advanced: {
    database: {
      // Generate user ID compatible with existing UUID format
      generateId: () => crypto.randomUUID(),
    },
  },
});

// Type inference for the auth instance with custom fields
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user & {
  teamId?: string | null;
  teamRole?: string | null;
  teamName?: string | null;
  teamSlug?: string | null;
  isAnonymous?: boolean | null; // From BetterAuth anonymous plugin
};
