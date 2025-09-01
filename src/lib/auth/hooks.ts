"use client";

import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

interface AnonymousSession {
  sessionId: string;
  expiresAt: string;
  data: Record<string, unknown>;
}

interface UserProfile {
  id: string;
  anonymous_id?: string;
  full_name?: string;
  avatar_url?: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  anonymousSession: AnonymousSession | null;
  isAnonymous: boolean;
}

const ANONYMOUS_SESSION_KEY = "velro_anonymous_session";

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: true,
    anonymousSession: null,
    isAnonymous: false,
  });

  const supabase = createBrowserClient();

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Check for authenticated session first
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth session error:", error);
        }

        if (session && session.user) {
          // Fetch user profile
          const response = await fetch("/api/v1/auth/session");
          const result = await response.json();

          if (mounted && result.success) {
            setAuthState({
              session,
              user: session.user,
              profile: result.data.profile,
              isAuthenticated: true,
              isLoading: false,
              anonymousSession: null,
              isAnonymous: false,
            });
            return;
          }
        }

        // Check for anonymous session
        const anonymousSessionData = localStorage.getItem(
          ANONYMOUS_SESSION_KEY,
        );
        let anonymousSession: AnonymousSession | null = null;

        if (anonymousSessionData) {
          try {
            const parsedSession = JSON.parse(anonymousSessionData);
            // Check if session is still valid
            if (new Date(parsedSession.expiresAt) > new Date()) {
              anonymousSession = parsedSession;
            } else {
              // Clean up expired session
              localStorage.removeItem(ANONYMOUS_SESSION_KEY);
            }
          } catch (error) {
            console.error("Invalid anonymous session data:", error);
            localStorage.removeItem(ANONYMOUS_SESSION_KEY);
          }
        }

        if (mounted) {
          setAuthState({
            session: null,
            user: null,
            profile: null,
            isAuthenticated: false,
            isLoading: false,
            anonymousSession,
            isAnonymous: !!anonymousSession,
          });
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (mounted) {
          setAuthState((prev) => ({
            ...prev,
            isLoading: false,
          }));
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session) {
        // Fetch user profile
        try {
          const response = await fetch("/api/v1/auth/session");
          const result = await response.json();

          setAuthState({
            session,
            user: session.user,
            profile: result.success ? result.data.profile : null,
            isAuthenticated: true,
            isLoading: false,
            anonymousSession: null,
            isAnonymous: false,
          });
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          setAuthState({
            session,
            user: session.user,
            profile: null,
            isAuthenticated: true,
            isLoading: false,
            anonymousSession: null,
            isAnonymous: false,
          });
        }
      } else if (event === "SIGNED_OUT") {
        // Check for anonymous session
        const anonymousSessionData = localStorage.getItem(
          ANONYMOUS_SESSION_KEY,
        );
        let anonymousSession: AnonymousSession | null = null;

        if (anonymousSessionData) {
          try {
            const parsedSession = JSON.parse(anonymousSessionData);
            if (new Date(parsedSession.expiresAt) > new Date()) {
              anonymousSession = parsedSession;
            } else {
              localStorage.removeItem(ANONYMOUS_SESSION_KEY);
            }
          } catch (error) {
            localStorage.removeItem(ANONYMOUS_SESSION_KEY);
          }
        }

        setAuthState({
          session: null,
          user: null,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
          anonymousSession,
          isAnonymous: !!anonymousSession,
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  // Create anonymous session
  const createAnonymousSession = useCallback(
    async (
      initialData?: Record<string, unknown>,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch("/api/v1/auth/anonymous", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: initialData }),
        });

        const result = await response.json();

        if (result.success) {
          const anonymousSession: AnonymousSession = {
            sessionId: result.data.sessionId,
            expiresAt: result.data.expiresAt,
            data: result.data.data,
          };

          // Store in localStorage
          localStorage.setItem(
            ANONYMOUS_SESSION_KEY,
            JSON.stringify(anonymousSession),
          );

          // Update state
          setAuthState((prev) => ({
            ...prev,
            anonymousSession,
            isAnonymous: true,
          }));

          return { success: true };
        }

        return { success: false, error: result.error };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create anonymous session",
        };
      }
    },
    [],
  );

  // Send magic link
  const sendMagicLink = useCallback(
    async (
      email: string,
      redirectTo?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch("/api/v1/auth/magic-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            anonymousId: authState.anonymousSession?.sessionId,
            redirectTo,
          }),
        });

        const result = await response.json();

        if (result.success) {
          return { success: true };
        }

        return { success: false, error: result.error };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to send magic link",
        };
      }
    },
    [authState.anonymousSession?.sessionId],
  );

  // Sign out
  const signOut = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      const response = await fetch("/api/v1/auth/session", {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        // Also clear anonymous session
        localStorage.removeItem(ANONYMOUS_SESSION_KEY);
        return { success: true };
      }

      return { success: false, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sign out",
      };
    }
  }, []);

  // Update anonymous session data
  const updateAnonymousSession = useCallback(
    async (
      data: Record<string, unknown>,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!authState.anonymousSession) {
        return { success: false, error: "No anonymous session found" };
      }

      try {
        const response = await fetch("/api/v1/auth/anonymous", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: authState.anonymousSession.sessionId,
            data,
          }),
        });

        const result = await response.json();

        if (result.success) {
          const updatedSession: AnonymousSession = {
            sessionId: result.data.sessionId,
            expiresAt: result.data.expiresAt,
            data: result.data.data,
          };

          // Update localStorage
          localStorage.setItem(
            ANONYMOUS_SESSION_KEY,
            JSON.stringify(updatedSession),
          );

          // Update state
          setAuthState((prev) => ({
            ...prev,
            anonymousSession: updatedSession,
          }));

          return { success: true };
        }

        return { success: false, error: result.error };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update anonymous session",
        };
      }
    },
    [authState.anonymousSession],
  );

  return {
    ...authState,
    createAnonymousSession,
    sendMagicLink,
    signOut,
    updateAnonymousSession,
  };
}
