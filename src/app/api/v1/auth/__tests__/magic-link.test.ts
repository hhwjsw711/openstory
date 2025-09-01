import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../magic-link/route";

// Mock AuthService
vi.mock("@/lib/auth/service", () => ({
  AuthService: vi.fn().mockImplementation(() => ({
    sendMagicLink: vi.fn(),
  })),
}));

describe("/api/v1/auth/magic-link", () => {
  let mockAuthService: any;

  beforeEach(async () => {
    const { AuthService } = vi.mocked(await import("@/lib/auth/service"));
    mockAuthService = {
      sendMagicLink: vi.fn(),
    };
    AuthService.prototype = mockAuthService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/auth/magic-link", () => {
    it("should send magic link successfully", async () => {
      mockAuthService.sendMagicLink.mockResolvedValue({ success: true });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/auth/magic-link",
        {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
          }),
        },
      );

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.message).toBe(
        "Magic link sent successfully. Check your email.",
      );
      expect(mockAuthService.sendMagicLink).toHaveBeenCalledWith(
        "user@example.com",
        undefined,
        undefined,
      );
    });

    it("should send magic link with anonymous ID", async () => {
      mockAuthService.sendMagicLink.mockResolvedValue({ success: true });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/auth/magic-link",
        {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
            anonymousId: "anonymous-123",
          }),
        },
      );

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(mockAuthService.sendMagicLink).toHaveBeenCalledWith(
        "user@example.com",
        "anonymous-123",
        undefined,
      );
    });

    it("should send magic link with custom redirect", async () => {
      mockAuthService.sendMagicLink.mockResolvedValue({ success: true });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/auth/magic-link",
        {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
            redirectTo: "http://localhost:3000/dashboard",
          }),
        },
      );

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(mockAuthService.sendMagicLink).toHaveBeenCalledWith(
        "user@example.com",
        undefined,
        "http://localhost:3000/dashboard",
      );
    });

    it("should return 400 for invalid email", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/v1/auth/magic-link",
        {
          method: "POST",
          body: JSON.stringify({
            email: "invalid-email",
          }),
        },
      );

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid request data");
      expect(result.details).toBeDefined();
    });

    it("should return 400 for missing email", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/v1/auth/magic-link",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid request data");
    });

    it("should handle auth service errors", async () => {
      mockAuthService.sendMagicLink.mockResolvedValue({
        success: false,
        error: "Email sending failed",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/auth/magic-link",
        {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
          }),
        },
      );

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Email sending failed");
    });

    it("should handle invalid redirect URL", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/v1/auth/magic-link",
        {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
            redirectTo: "not-a-url",
          }),
        },
      );

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid request data");
    });

    it("should handle unexpected errors", async () => {
      mockAuthService.sendMagicLink.mockRejectedValue(
        new Error("Unexpected error"),
      );

      const request = new NextRequest(
        "http://localhost:3000/api/v1/auth/magic-link",
        {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
          }),
        },
      );

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unexpected error");
    });
  });
});
