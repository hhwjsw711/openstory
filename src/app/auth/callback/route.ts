import { type NextRequest, NextResponse } from "next/server";
import { createSessionAwareClient } from "@/lib/supabase/server";

/**
 * Handle magic link callback
 * GET /auth/callback
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const _anonymousId = requestUrl.searchParams.get("anonymousId");
  const redirectTo = requestUrl.searchParams.get("redirectTo") || "/dashboard";

  if (code) {
    try {
      const supabase = await createSessionAwareClient();

      // Exchange code for session
      const { data: sessionData, error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (sessionError) {
        console.error("Session exchange error:", sessionError);
        return NextResponse.redirect(
          new URL(
            `/login?error=${encodeURIComponent("Authentication failed")}`,
            request.url,
          ),
        );
      }

      const session = sessionData.session;
      const user = session?.user;

      if (!user) {
        return NextResponse.redirect(
          new URL(
            `/login?error=${encodeURIComponent("No user found")}`,
            request.url,
          ),
        );
      }

      // For anonymous upgrade, we now use the native Supabase approach
      // Anonymous users already have:
      // 1. A team (created when they became anonymous)
      // 2. A user record (created when they became anonymous)
      // 3. Team membership as owner (created when they became anonymous)
      // Note: Email is stored only in auth.users, not in our users table

      // Update the user profile data (not email, which is in auth.users)
      const { error: userError } = await supabase
        .from("users")
        .upsert({
          id: user.id,
          full_name:
            user.user_metadata?.full_name || user.email?.split("@")[0] || null,
          avatar_url: user.user_metadata?.avatar_url || null,
        })
        .select()
        .single();

      if (userError && userError.code !== "42P01") {
        // Ignore "relation does not exist" errors
        console.error("Error updating user profile:", userError);
      }

      // Update team name to be more personalized if this is a user with email
      if (user.email) {
        // Get user's team ID
        const { data: teamMembership } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .eq("role", "owner")
          .single();

        if (teamMembership) {
          const teamName = user.user_metadata?.full_name
            ? `${user.user_metadata.full_name}'s Team`
            : `${user.email.split("@")[0]}'s Team`;

          await supabase
            .from("teams")
            .update({ name: teamName })
            .eq("id", teamMembership.team_id);
        }
      }

      // Update user profile metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name:
            user.user_metadata?.full_name || user.email?.split("@")[0] || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          onboarding_completed:
            user.user_metadata?.onboarding_completed || false,
        },
      });

      if (updateError) {
        console.error("Error updating user metadata:", updateError);
      }

      // Redirect to the intended destination
      const redirectUrl = new URL(redirectTo, request.url);

      // Add success parameter
      redirectUrl.searchParams.set("auth", "success");

      return NextResponse.redirect(redirectUrl);
    } catch (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`,
          request.url,
        ),
      );
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(
    new URL(
      `/login?error=${encodeURIComponent("Invalid authentication request")}`,
      request.url,
    ),
  );
}
