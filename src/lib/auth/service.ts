import { randomUUID } from "node:crypto";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Json = Database["public"]["Tables"]["anonymous_sessions"]["Row"]["data"];

type AnonymousSession =
  Database["public"]["Tables"]["anonymous_sessions"]["Row"];
type AnonymousSessionInsert =
  Database["public"]["Tables"]["anonymous_sessions"]["Insert"];
type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
type UserProfileInsert =
  Database["public"]["Tables"]["user_profiles"]["Insert"];

export class AuthService {
  private supabase = createServerClient();
  private adminClient = createAdminClient();

  /**
   * Create an anonymous session for users who want to start working without signing up
   */
  async createAnonymousSession(
    initialData?: Record<string, unknown>,
  ): Promise<AnonymousSession> {
    const sessionId = randomUUID();

    const sessionData: AnonymousSessionInsert = {
      id: sessionId,
      data: (initialData || {}) as Json,
    };

    const { data, error } = await this.supabase
      .from("anonymous_sessions")
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create anonymous session: ${error.message}`);
    }

    return data;
  }

  /**
   * Get an anonymous session by ID
   */
  async getAnonymousSession(
    sessionId: string,
  ): Promise<AnonymousSession | null> {
    const { data, error } = await this.supabase
      .from("anonymous_sessions")
      .select("*")
      .eq("id", sessionId)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to get anonymous session: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Update anonymous session data
   */
  async updateAnonymousSession(
    sessionId: string,
    data: Record<string, unknown>,
  ): Promise<AnonymousSession> {
    const { data: updatedSession, error } = await this.supabase
      .from("anonymous_sessions")
      .update({ data: data as Json })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update anonymous session: ${error.message}`);
    }

    return updatedSession;
  }

  /**
   * Send magic link to user's email
   */
  async sendMagicLink(
    email: string,
    anonymousId?: string,
    redirectTo?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Prepare redirect URL with anonymous ID if provided
      let finalRedirectTo =
        redirectTo || `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;

      if (anonymousId) {
        const url = new URL(finalRedirectTo);
        url.searchParams.set("anonymousId", anonymousId);
        finalRedirectTo = url.toString();
      }

      const { error } = await this.supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: finalRedirectTo,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Upgrade anonymous session to authenticated user
   */
  async upgradeAnonymousSession(
    userId: string,
    anonymousId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the anonymous session data
      const anonymousSession = await this.getAnonymousSession(anonymousId);

      if (!anonymousSession) {
        return {
          success: false,
          error: "Anonymous session not found or expired",
        };
      }

      // Start a transaction-like operation
      const { error: profileError } = await this.adminClient
        .from("user_profiles")
        .upsert({
          id: userId,
          anonymous_id: anonymousId,
          // Transfer any relevant data from anonymous session if needed
        });

      if (profileError) {
        throw new Error(
          `Failed to create user profile: ${profileError.message}`,
        );
      }

      // If the anonymous session had a team, we could associate it with the user here
      // For now, we'll just clean up the anonymous session
      const { error: deleteError } = await this.adminClient
        .from("anonymous_sessions")
        .delete()
        .eq("id", anonymousId);

      if (deleteError) {
        console.warn(
          `Failed to clean up anonymous session: ${deleteError.message}`,
        );
        // Don't fail the upgrade for this
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Get current session from Supabase
   */
  async getSession() {
    try {
      const { data, error } = await this.supabase.auth.getSession();

      if (error) {
        throw new Error(`Failed to get session: ${error.message}`);
      }

      return data.session;
    } catch (error) {
      console.error("Session error:", error);
      return null;
    }
  }

  /**
   * Get user profile by user ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to get user profile: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Create or update user profile
   */
  async upsertUserProfile(profile: UserProfileInsert): Promise<UserProfile> {
    const { data, error } = await this.adminClient
      .from("user_profiles")
      .upsert(profile)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert user profile: ${error.message}`);
    }

    return data;
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Clean up expired anonymous sessions (utility method)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const { data, error } = await this.adminClient.rpc(
      "cleanup_expired_anonymous_sessions",
    );

    if (error) {
      throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
    }

    return data || 0;
  }
}
