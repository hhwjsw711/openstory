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
  DATABASE_URL: process.env.DATABASE_URL,
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
    requireEmailVerification: process.env.NODE_ENV === "production",
    sendEmailVerificationOnSignUp: process.env.NODE_ENV === "production",
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

          // 2. Get the new user's auto-created team (the one we'll delete)
          const { data: newUserTeam } = await supabase
            .from("team_members")
            .select("team_id")
            .eq("user_id", newUser.user.id)
            .eq("role", "owner")
            .single();

          // 3. Transfer team ownership from anonymous to authenticated user
          const { error: teamError } = await supabase
            .from("team_members")
            .update({ user_id: newUser.user.id })
            .eq("user_id", anonymousUser.user.id)
            .eq("role", "owner");

          if (teamError) throw teamError;

          // 4. Delete the new user's auto-created empty team (if it exists and is different)
          if (
            newUserTeam &&
            anonymousTeam &&
            newUserTeam.team_id !== anonymousTeam.team_id
          ) {
            // First delete the team membership
            await supabase
              .from("team_members")
              .delete()
              .eq("team_id", newUserTeam.team_id);

            // Then delete the empty team
            await supabase.from("teams").delete().eq("id", newUserTeam.team_id);

            console.log(
              "[BetterAuth] Deleted auto-created team:",
              newUserTeam.team_id,
            );
          }

          // 5. Transfer sequences created by anonymous user
          const { error: sequenceError } = await supabase
            .from("sequences")
            .update({
              created_by: newUser.user.id,
              updated_by: newUser.user.id,
            })
            .eq("created_by", anonymousUser.user.id);

          if (sequenceError) throw sequenceError;

          // 6. Transfer styles
          const { error: stylesError } = await supabase
            .from("styles")
            .update({ created_by: newUser.user.id })
            .eq("created_by", anonymousUser.user.id);

          if (stylesError) throw stylesError;

          // 7. Transfer characters
          const { error: charactersError } = await supabase
            .from("characters")
            .update({ created_by: newUser.user.id })
            .eq("created_by", anonymousUser.user.id);

          if (charactersError) throw charactersError;

          // 8. Transfer VFX
          const { error: vfxError } = await supabase
            .from("vfx")
            .update({ created_by: newUser.user.id })
            .eq("created_by", anonymousUser.user.id);

          if (vfxError) throw vfxError;

          // 9. Transfer audio
          const { error: audioError } = await supabase
            .from("audio")
            .update({ created_by: newUser.user.id })
            .eq("created_by", anonymousUser.user.id);

          if (audioError) throw audioError;

          // 10. Transfer credits (if anonymous user has any)
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

          // 11. Transfer jobs
          const { error: jobsError } = await supabase
            .from("jobs")
            .update({ user_id: newUser.user.id })
            .eq("user_id", anonymousUser.user.id);

          if (jobsError) throw jobsError;

          // 12. Clean up anonymous user data
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
