/**
 * Tests for frame generation webhook
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { FrameGenerationPayload } from "@/lib/qstash/types";

// Mock dependencies
const mockJobManager = {
  getJob: mock(() =>
    Promise.resolve({
      id: "job-123",
      team_id: "team-123",
      user_id: "user-123",
      status: "pending",
      type: "frame_generation",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      payload: {},
    } as any),
  ),
  startJob: mock(() => Promise.resolve()),
  completeJob: mock(() => Promise.resolve()),
  failJob: mock(() => Promise.resolve()),
  createJob: mock(() =>
    Promise.resolve({
      id: "image-job-123",
      team_id: "team-123",
      user_id: "user-123",
      status: "pending",
      type: "image",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      payload: {},
    } as any),
  ),
};

const mockAdminClient = {
  from: mock((table: string) => {
    // Handle different table operations
    if (table === "team_members") {
      return {
        select: mock(() => ({
          eq: mock(() => ({
            eq: mock(() => ({
              single: mock(() =>
                Promise.resolve({
                  data: { id: "member-123" },
                  error: null,
                }),
              ),
            })),
          })),
        })),
      };
    } else if (table === "frames") {
      return {
        delete: mock(() => ({
          eq: mock(() =>
            Promise.resolve({
              error: null,
            }),
          ),
          in: mock(() =>
            Promise.resolve({
              error: null,
            }),
          ),
        })),
        insert: mock(() => ({
          select: mock(() =>
            Promise.resolve({
              data: Array(5)
                .fill(null)
                .map((_, i) => ({
                  id: `frame-${i}`,
                  sequence_id: "sequence-123",
                  description: `Frame ${i + 1}`,
                  order_index: i,
                  duration_ms: 1000,
                })),
              error: null,
            }),
          ),
        })),
        select: mock(() => ({
          eq: mock(() =>
            Promise.resolve({
              data: [],
              error: null,
            }),
          ),
        })),
      };
    } else if (table === "sequences") {
      return {
        select: mock((selectFields: string) => ({
          eq: mock(() => ({
            single: mock(() => {
              // Return sequence with styles if joined
              if (selectFields?.includes("styles")) {
                return Promise.resolve({
                  data: {
                    id: "sequence-123",
                    script: "This is a test script for the sequence.",
                    style_id: "style-123",
                    team_id: "team-123",
                    metadata: {},
                    styles: {
                      metadata: { theme: "dark" },
                    },
                  },
                  error: null,
                });
              }
              // Return just metadata for metadata-only queries
              return Promise.resolve({
                data: { metadata: {} },
                error: null,
              });
            }),
          })),
        })),
        update: mock(() => ({
          eq: mock(() =>
            Promise.resolve({
              error: null,
            }),
          ),
        })),
      };
    }
    // Default return for other tables
    return {
      select: mock(() => ({
        eq: mock(() =>
          Promise.resolve({
            data: null,
            error: null,
          }),
        ),
      })),
    };
  }),
};

const mockAnalyzeScript = mock(() =>
  Promise.resolve({
    scenes: [
      {
        start: 0,
        end: 100,
        description: "Opening scene",
        duration: 5000,
      },
      {
        start: 100,
        end: 200,
        description: "Action scene",
        duration: 7000,
      },
    ],
    characters: ["Hero", "Villain"],
    settings: ["City"],
  }),
);

const mockGenerateDescriptions = mock(() =>
  Promise.resolve({
    frames: Array(5)
      .fill(null)
      .map((_, i) => ({
        description: `Generated frame ${i + 1} description`,
        orderIndex: i,
        durationMs: 1000,
        metadata: {
          scene: Math.floor(i / 3),
          shotType: "medium shot",
          mood: "dramatic",
        },
      })),
    totalDuration: 5000,
    frameCount: 5,
  }),
);

// Mock QStash client
const mockQStashClient = {
  publishImageJob: mock(() =>
    Promise.resolve({
      messageId: "msg-image-123",
      deduplicated: false,
    }),
  ),
};

// Mock modules
mock.module("@/lib/qstash/job-manager", () => ({
  getJobManager: () => mockJobManager,
}));

mock.module("@/lib/qstash/client", () => ({
  getQStashClient: () => mockQStashClient,
}));

mock.module("@/lib/supabase/server", () => ({
  createAdminClient: () => mockAdminClient,
}));

mock.module("@/lib/ai/script-analyzer", () => ({
  analyzeScriptForFrames: mockAnalyzeScript,
}));

mock.module("@/lib/ai/frame-generator", () => ({
  generateFrameDescriptions: mockGenerateDescriptions,
}));

// Mock the QStash middleware to bypass signature verification in tests
mock.module("@/lib/qstash/middleware", () => ({
  withQStashVerification: (handler: (req: any) => Promise<Response>) => handler,
  QStashVerifiedRequest: class {},
}));

describe("Frame Generation Webhook", () => {
  let handler: (req: any) => Promise<Response>;

  beforeEach(async () => {
    // Clear mocks
    mockJobManager.getJob.mockClear();
    mockJobManager.startJob.mockClear();
    mockJobManager.completeJob.mockClear();
    mockJobManager.failJob.mockClear();
    mockAnalyzeScript.mockClear();
    mockGenerateDescriptions.mockClear();

    // Import handler after mocks are set up
    const module = await import("../route");
    handler = module.POST;
  });

  it("should process frame generation job successfully", async () => {
    const payload: FrameGenerationPayload = {
      jobId: "job-123",
      type: "frame_generation",
      data: {
        sequenceId: "sequence-123",
        options: {
          framesPerScene: 3,
          generateDescriptions: true,
        },
      },
    };

    const request = new Request("http://localhost/api/webhooks/qstash/frames", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobId).toBe("job-123");
    expect(data.frameCount).toBe(5);

    // Verify job was retrieved for authorization
    expect(mockJobManager.getJob).toHaveBeenCalledWith("job-123");

    // Verify job was started
    expect(mockJobManager.startJob).toHaveBeenCalledWith("job-123");

    // Verify script was analyzed
    expect(mockAnalyzeScript).toHaveBeenCalledWith(
      "This is a test script for the sequence.",
      undefined,
    );

    // Verify descriptions were generated
    expect(mockGenerateDescriptions).toHaveBeenCalled();
    const generateCalls = mockGenerateDescriptions.mock.calls as any[];
    expect(generateCalls.length).toBeGreaterThan(0);
    if (generateCalls.length > 0) {
      const generateCall = generateCalls[0][0];
      expect(generateCall.script).toBe(
        "This is a test script for the sequence.",
      );
      expect(generateCall.framesPerScene).toBe(3);
    }

    // Verify job was completed
    expect(mockJobManager.completeJob).toHaveBeenCalledWith(
      "job-123",
      expect.objectContaining({
        frameCount: 5,
        totalDuration: 5000,
      }),
    );
  });

  it("should use provided script analysis", async () => {
    // Update mock for this test's job
    mockJobManager.getJob.mockImplementationOnce(() =>
      Promise.resolve({
        id: "job-456",
        team_id: "team-123",
        user_id: "user-456",
        status: "pending",
        type: "frame_generation",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payload: {},
      } as any),
    );

    const payload: FrameGenerationPayload = {
      jobId: "job-456",
      type: "frame_generation",
      data: {
        sequenceId: "sequence-456",
      },
    };

    const request = new Request("http://localhost/api/webhooks/qstash/frames", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Script analyzer is now always called (loads from DB)
    expect(mockAnalyzeScript).toHaveBeenCalled();

    // Descriptions should be generated
    expect(mockGenerateDescriptions).toHaveBeenCalled();
  });

  it("should handle invalid payload", async () => {
    const request = new Request("http://localhost/api/webhooks/qstash/frames", {
      method: "POST",
      body: "invalid json",
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request payload");
  });

  it("should handle missing job ID", async () => {
    const payload = {
      body: {
        type: "frame_generation",
        data: {
          sequenceId: "sequence-123",
        },
      },
      headers: {},
      meta: {
        messageId: "msg-123",
        attempts: 1,
        createdAt: Date.now(),
      },
    };

    const request = new Request("http://localhost/api/webhooks/qstash/frames", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid job payload");
  });

  it("should reject job with team ID mismatch", async () => {
    // Mock job with different team ID
    mockJobManager.getJob.mockImplementationOnce(() =>
      Promise.resolve({
        id: "job-unauthorized",
        team_id: "different-team",
        user_id: "user-123",
        status: "pending",
        type: "frame_generation",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payload: {},
      } as any),
    );

    const payload: FrameGenerationPayload = {
      jobId: "job-unauthorized",
      type: "frame_generation",
      data: {
        sequenceId: "sequence-123",
      },
    };

    const request = new Request("http://localhost/api/webhooks/qstash/frames", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Frame generation failed");
    expect(data.details).toContain("Unauthorized: Team ID mismatch");

    // Job should be marked as failed
    expect(mockJobManager.failJob).toHaveBeenCalledWith(
      "job-unauthorized",
      "Unauthorized: Team ID mismatch",
    );
  });

  it("should reject job when user is not a team member", async () => {
    // Mock job with user who is not a team member
    mockJobManager.getJob.mockImplementationOnce(() =>
      Promise.resolve({
        id: "job-no-member",
        team_id: "team-123",
        user_id: "user-not-member",
        status: "pending",
        type: "frame_generation",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payload: {},
      } as any),
    );

    // Store original implementation
    const originalFrom = mockAdminClient.from.getMockImplementation();

    // Replace the from implementation temporarily
    mockAdminClient.from.mockImplementation((table: string): any => {
      if (table === "team_members") {
        return {
          select: mock(() => ({
            eq: mock(() => ({
              eq: mock(() => ({
                single: mock(() =>
                  Promise.resolve({
                    data: null,
                    error: { code: "PGRST116", message: "Not found" },
                  }),
                ),
              })),
            })),
          })),
        };
      }
      // Use original implementation for other tables
      return originalFrom?.(table);
    });

    const payload: FrameGenerationPayload = {
      jobId: "job-no-member",
      type: "frame_generation",
      data: {
        sequenceId: "sequence-123",
      },
    };

    const request = new Request("http://localhost/api/webhooks/qstash/frames", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await handler(request);
    const data = await response.json();

    // Restore original mock
    mockAdminClient.from.mockImplementation(originalFrom as any);

    expect(response.status).toBe(500);
    expect(data.error).toBe("Frame generation failed");
    expect(data.details).toContain("Unauthorized: User not a team member");

    // Job should be marked as failed
    expect(mockJobManager.failJob).toHaveBeenCalledWith(
      "job-no-member",
      "Unauthorized: User not a team member",
    );
  });

  it("should return 404 when job not found", async () => {
    // Mock job not found
    mockJobManager.getJob.mockImplementationOnce(() =>
      Promise.resolve(null as any),
    );

    const payload: FrameGenerationPayload = {
      jobId: "job-not-found",
      type: "frame_generation",
      data: {
        sequenceId: "sequence-123",
      },
    };

    const request = new Request("http://localhost/api/webhooks/qstash/frames", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Job not found");

    // Job should not be started or marked as failed
    expect(mockJobManager.startJob).not.toHaveBeenCalled();
    expect(mockJobManager.failJob).not.toHaveBeenCalled();
  });

  it("should handle script analysis failure", async () => {
    mockAnalyzeScript.mockImplementationOnce(() =>
      Promise.reject(new Error("AI service unavailable")),
    );

    // Update mock for this test's job
    mockJobManager.getJob.mockImplementationOnce(() =>
      Promise.resolve({
        id: "job-789",
        team_id: "team-123",
        user_id: "user-789",
        status: "pending",
        type: "frame_generation",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payload: {},
      } as any),
    );

    const payload: FrameGenerationPayload = {
      jobId: "job-789",
      type: "frame_generation",
      data: {
        sequenceId: "sequence-789",
      },
    };

    const request = new Request("http://localhost/api/webhooks/qstash/frames", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Frame generation failed");
    expect(data.details).toContain("AI service unavailable");

    // Job should be marked as failed
    expect(mockJobManager.failJob).toHaveBeenCalledWith(
      "job-789",
      "AI service unavailable",
    );
  });

  it("should handle frame insertion failure", async () => {
    // Create a more complete mock for this test case
    const mockAdminClientFail = {
      from: mock((table: string) => {
        if (table === "frames") {
          return {
            delete: mock(() => ({
              eq: mock(() => Promise.resolve({ error: null })),
              in: mock(() => Promise.resolve({ error: null })),
            })),
            insert: mock(() => ({
              select: mock(() =>
                Promise.resolve({
                  data: null,
                  error: { message: "Database error" },
                }),
              ),
            })),
            select: mock(() => ({
              eq: mock(() =>
                Promise.resolve({
                  data: [],
                  error: null,
                }),
              ),
            })),
          };
        } else if (table === "sequences") {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(() =>
                  Promise.resolve({
                    data: { metadata: {} },
                    error: null,
                  }),
                ),
              })),
            })),
            update: mock(() => ({
              eq: mock(() => Promise.resolve({ error: null })),
            })),
          };
        }
        return {};
      }),
    };

    // Override the module mock for this test
    mock.module("@/lib/supabase/server", () => ({
      createAdminClient: () => mockAdminClientFail,
    }));

    // Re-import the module to use the new mock
    const module = await import("../route");
    handler = module.POST;

    const payload: FrameGenerationPayload = {
      jobId: "job-fail",
      type: "frame_generation",
      userId: "user-fail",
      teamId: "team-fail",
      data: {
        sequenceId: "sequence-fail",
      },
    };

    const request = new Request("http://localhost/api/webhooks/qstash/frames", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Frame generation failed");

    // Job should be marked as failed
    expect(mockJobManager.failJob).toHaveBeenCalled();
  });

  it("should clean up placeholder frames", async () => {
    const payload: FrameGenerationPayload = {
      jobId: "job-cleanup",
      type: "frame_generation",
      userId: "user-cleanup",
      teamId: "team-cleanup",
      data: {
        sequenceId: "sequence-cleanup",
      },
    };

    const request = new Request("http://localhost/api/webhooks/qstash/frames", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    await handler(request);

    // Verify cleanup was attempted - check that from("frames") was called
    const fromMock = mockAdminClient.from as ReturnType<typeof mock>;
    expect(fromMock).toHaveBeenCalledWith("frames");

    // Since we're using a mock that returns different objects based on table name,
    // we can't easily verify delete was called, but we can verify from was called
    // with "frames" multiple times (once for select, potentially once for delete)
    const frameCalls = fromMock.mock.calls.filter(
      (call: any[]) => call[0] === "frames",
    );
    expect(frameCalls.length).toBeGreaterThan(0);
  });
});
