import { type NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/auth/service";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Handle magic link callback
 * GET /auth/callback
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const anonymousId = requestUrl.searchParams.get("anonymousId");
  const redirectTo = requestUrl.searchParams.get("redirectTo") || "/dashboard";

  if (code) {
    try {
      const supabase = createServerClient();

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

      const authService = new AuthService();

      // If there's an anonymous session to upgrade, do it
      if (anonymousId) {
        const upgradeResult = await authService.upgradeAnonymousSession(
          user.id,
          anonymousId,
        );

        if (!upgradeResult.success) {
          console.warn(
            "Failed to upgrade anonymous session:",
            upgradeResult.error,
          );
          // Don't fail the login process for this
        }
      }

      // Ensure user profile exists
      let userProfile = await authService.getUserProfile(user.id);

      if (!userProfile) {
        userProfile = await authService.upsertUserProfile({
          id: user.id,
          anonymous_id: anonymousId || null,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0],
          avatar_url: user.user_metadata?.avatar_url || null,
          onboarding_completed: false,
        });
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
