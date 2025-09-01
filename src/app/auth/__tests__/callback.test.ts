import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../callback/route";

// Mock AuthService
vi.mock("@/lib/auth/service", () => ({
  AuthService: vi.fn().mockImplementation(() => ({
    upgradeAnonymousSession: vi.fn(),
    getUserProfile: vi.fn(),
    upsertUserProfile: vi.fn(),
  })),
}));

// Mock Supabase client
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: vi.fn(),
    },
  })),
}));

// Mock NextResponse.redirect
vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      redirect: vi.fn((url: URL) => ({
        status: 302,
        headers: new Headers({
          Location: url.toString(),
        }),
      })),
    },
  };
});

describe("/auth/callback", () => {
  let mockAuthService: any;
  let mockSupabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockAuthService = {
      upgradeAnonymousSession: vi.fn(),
      getUserProfile: vi.fn(),
      upsertUserProfile: vi.fn(),
    };

    mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn(),
      },
    };

    const { AuthService } = await import("@/lib/auth/service");
    vi.mocked(AuthService).mockImplementation(() => mockAuthService as any);

    const { createServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful authentication flow", () => {
    it("should exchange code for session and redirect to dashboard", async () => {
      const mockSession = {
        session: {
          user: {
            id: "user-123",
            email: "test@example.com",
            user_metadata: {
              full_name: "Test User",
              avatar_url: "https://example.com/avatar.jpg",
            },
          },
        },
      };

      const mockProfile = {
        id: "user-123",
        full_name: "Test User",
        avatar_url: "https://example.com/avatar.jpg",
        onboarding_completed: true,
      };

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: mockSession,
        error: null,
      });
      mockAuthService.getUserProfile.mockResolvedValue(mockProfile);

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test-code",
      );

      const response = await GET(request);

      expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
        "test-code",
      );
      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith("user-123");
      expect(mockAuthService.upsertUserProfile).not.toHaveBeenCalled();
      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/dashboard");
      expect(redirectCall.toString()).toContain("auth=success");
    });

    it("should create user profile on first login", async () => {
      const mockSession = {
        session: {
          user: {
            id: "new-user-456",
            email: "newuser@example.com",
            user_metadata: {},
          },
        },
      };

      const mockNewProfile = {
        id: "new-user-456",
        full_name: "newuser",
        avatar_url: null,
        onboarding_completed: false,
      };

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: mockSession,
        error: null,
      });
      mockAuthService.getUserProfile.mockResolvedValue(null);
      mockAuthService.upsertUserProfile.mockResolvedValue(mockNewProfile);

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=new-user-code",
      );

      const response = await GET(request);

      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith(
        "new-user-456",
      );
      expect(mockAuthService.upsertUserProfile).toHaveBeenCalledWith({
        id: "new-user-456",
        anonymous_id: null,
        full_name: "newuser",
        avatar_url: null,
        onboarding_completed: false,
      });
      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/dashboard");
      expect(redirectCall.toString()).toContain("auth=success");
    });

    it("should upgrade anonymous session when anonymousId is provided", async () => {
      const mockSession = {
        session: {
          user: {
            id: "user-789",
            email: "upgrade@example.com",
            user_metadata: {
              full_name: "Upgrade User",
            },
          },
        },
      };

      const mockProfile = {
        id: "user-789",
        full_name: "Upgrade User",
        onboarding_completed: false,
      };

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: mockSession,
        error: null,
      });
      mockAuthService.getUserProfile.mockResolvedValue(mockProfile);
      mockAuthService.upgradeAnonymousSession.mockResolvedValue({
        success: true,
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=upgrade-code&anonymousId=anon-session-123",
      );

      const response = await GET(request);

      expect(mockAuthService.upgradeAnonymousSession).toHaveBeenCalledWith(
        "user-789",
        "anon-session-123",
      );
      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/dashboard");
      expect(redirectCall.toString()).toContain("auth=success");
    });

    it("should handle custom redirectTo parameter", async () => {
      const mockSession = {
        session: {
          user: {
            id: "user-redirect",
            email: "redirect@example.com",
          },
        },
      };

      const mockProfile = {
        id: "user-redirect",
        full_name: "Redirect User",
      };

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: mockSession,
        error: null,
      });
      mockAuthService.getUserProfile.mockResolvedValue(mockProfile);

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=redirect-code&redirectTo=/profile/settings",
      );

      const response = await GET(request);

      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/profile/settings");
      expect(redirectCall.toString()).toContain("auth=success");
    });

    it("should continue auth flow even if anonymous session upgrade fails", async () => {
      const mockSession = {
        session: {
          user: {
            id: "user-fail-upgrade",
            email: "failupgrade@example.com",
          },
        },
      };

      const mockProfile = {
        id: "user-fail-upgrade",
        full_name: "Fail Upgrade User",
      };

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: mockSession,
        error: null,
      });
      mockAuthService.getUserProfile.mockResolvedValue(mockProfile);
      mockAuthService.upgradeAnonymousSession.mockResolvedValue({
        success: false,
        error: "Failed to transfer data",
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=fail-upgrade-code&anonymousId=anon-fail-123",
      );

      const response = await GET(request);

      expect(mockAuthService.upgradeAnonymousSession).toHaveBeenCalledWith(
        "user-fail-upgrade",
        "anon-fail-123",
      );
      // Should still redirect successfully despite upgrade failure
      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/dashboard");
      expect(redirectCall.toString()).toContain("auth=success");
    });
  });

  describe("Error handling", () => {
    it("should redirect to login with error when code exchange fails", async () => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: null,
        error: { message: "Invalid or expired code" },
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=invalid-code",
      );

      const response = await GET(request);

      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/login");
      expect(redirectCall.toString()).toContain("error=Authentication");
    });

    it("should redirect to login when no user is found in session", async () => {
      const mockSession = {
        session: {
          user: null,
        },
      };

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=no-user-code",
      );

      const response = await GET(request);

      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/login");
      expect(redirectCall.toString()).toContain("error=No%20user%20found");
    });

    it("should handle missing code parameter", async () => {
      const request = new NextRequest("http://localhost:3000/auth/callback");

      const response = await GET(request);

      expect(mockSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/login");
      expect(redirectCall.toString()).toContain(
        "error=Invalid%20authentication%20request",
      );
    });

    it("should handle exceptions during authentication process", async () => {
      mockSupabase.auth.exchangeCodeForSession.mockRejectedValue(
        new Error("Network error"),
      );

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=error-code",
      );

      const response = await GET(request);

      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/login");
      expect(redirectCall.toString()).toContain(
        "error=Authentication%20failed",
      );
    });

    it("should handle profile creation errors gracefully", async () => {
      const mockSession = {
        session: {
          user: {
            id: "profile-error-user",
            email: "profileerror@example.com",
          },
        },
      };

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: mockSession,
        error: null,
      });
      mockAuthService.getUserProfile.mockResolvedValue(null);
      mockAuthService.upsertUserProfile.mockRejectedValue(
        new Error("Database error"),
      );

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=profile-error-code",
      );

      const response = await GET(request);

      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/login");
      expect(redirectCall.toString()).toContain(
        "error=Authentication%20failed",
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle user with minimal metadata", async () => {
      const mockSession = {
        session: {
          user: {
            id: "minimal-user",
            email: "minimal@example.com",
            user_metadata: null,
          },
        },
      };

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: mockSession,
        error: null,
      });
      mockAuthService.getUserProfile.mockResolvedValue(null);
      mockAuthService.upsertUserProfile.mockResolvedValue({
        id: "minimal-user",
        full_name: "minimal",
        avatar_url: null,
        onboarding_completed: false,
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=minimal-code",
      );

      const response = await GET(request);

      expect(mockAuthService.upsertUserProfile).toHaveBeenCalledWith({
        id: "minimal-user",
        anonymous_id: null,
        full_name: "minimal",
        avatar_url: null,
        onboarding_completed: false,
      });
      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/dashboard");
      expect(redirectCall.toString()).toContain("auth=success");
    });

    it("should handle user without email", async () => {
      const mockSession = {
        session: {
          user: {
            id: "no-email-user",
            email: null,
            user_metadata: {
              full_name: "No Email User",
            },
          },
        },
      };

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: mockSession,
        error: null,
      });
      mockAuthService.getUserProfile.mockResolvedValue(null);
      mockAuthService.upgradeAnonymousSession.mockResolvedValue({
        success: true,
      });
      mockAuthService.upsertUserProfile.mockResolvedValue({
        id: "no-email-user",
        full_name: "No Email User",
        avatar_url: null,
        onboarding_completed: false,
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=no-email-code&anonymousId=anon-no-email",
      );

      const response = await GET(request);

      expect(mockAuthService.upgradeAnonymousSession).toHaveBeenCalledWith(
        "no-email-user",
        "anon-no-email",
      );
      expect(mockAuthService.upsertUserProfile).toHaveBeenCalledWith({
        id: "no-email-user",
        anonymous_id: "anon-no-email",
        full_name: "No Email User",
        avatar_url: null,
        onboarding_completed: false,
      });
      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/dashboard");
      expect(redirectCall.toString()).toContain("auth=success");
    });

    it("should handle URL-encoded redirectTo parameters", async () => {
      const mockSession = {
        session: {
          user: {
            id: "encoded-redirect-user",
            email: "encoded@example.com",
          },
        },
      };

      const mockProfile = {
        id: "encoded-redirect-user",
        full_name: "Encoded User",
      };

      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: mockSession,
        error: null,
      });
      mockAuthService.getUserProfile.mockResolvedValue(mockProfile);

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=encoded-code&redirectTo=%2Fprofile%2Fsettings%3Ftab%3Dsecurity",
      );

      const response = await GET(request);

      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0][0];
      expect(redirectCall.toString()).toContain("/profile/settings");
      expect(redirectCall.toString()).toContain("tab=security");
      expect(redirectCall.toString()).toContain("auth=success");
    });
  });
});
