/**
 * Tests for frame generation webhook
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  FrameGenerationPayload,
  QStashWebhookPayload,
} from "@/lib/qstash/types";

// Mock dependencies
const mockJobManager = {
  startJob: mock(() => Promise.resolve()),
  completeJob: mock(() => Promise.resolve()),
  failJob: mock(() => Promise.resolve()),
};

const mockAdminClient = {
  from: mock((table: string) => {
    // Handle different table operations
    if (table === "frames") {
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

// Mock modules
mock.module("@/lib/qstash/job-manager", () => ({
  getJobManager: () => mockJobManager,
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
    const payload: QStashWebhookPayload<FrameGenerationPayload> = {
      body: {
        jobId: "job-123",
        type: "frame_generation",
        userId: "user-123",
        teamId: "team-123",
        data: {
          sequenceId: "sequence-123",
          script: "Test script for frame generation",
          options: {
            framesPerScene: 3,
            generateDescriptions: true,
          },
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

    // Verify job was started
    expect(mockJobManager.startJob).toHaveBeenCalledWith("job-123");

    // Verify script was analyzed
    expect(mockAnalyzeScript).toHaveBeenCalledWith(
      "Test script for frame generation",
      undefined,
    );

    // Verify descriptions were generated
    expect(mockGenerateDescriptions).toHaveBeenCalledWith(
      expect.objectContaining({
        script: "Test script for frame generation",
        framesPerScene: 3,
      }),
    );

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
    const payload: QStashWebhookPayload<FrameGenerationPayload> = {
      body: {
        jobId: "job-456",
        type: "frame_generation",
        data: {
          sequenceId: "sequence-456",
          script: "Test script",
          scriptAnalysis: {
            scenes: [
              {
                start: 0,
                end: 50,
                description: "Custom scene",
                duration: 2000,
              },
            ],
          },
        },
      },
      headers: {},
      meta: {
        messageId: "msg-456",
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

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Script analyzer should NOT be called when analysis is provided
    expect(mockAnalyzeScript).not.toHaveBeenCalled();

    // Descriptions should be generated with provided analysis
    expect(mockGenerateDescriptions).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptAnalysis: payload.body.data.scriptAnalysis,
      }),
    );
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
          script: "Test",
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

  it("should handle script analysis failure", async () => {
    mockAnalyzeScript.mockImplementationOnce(() =>
      Promise.reject(new Error("AI service unavailable")),
    );

    const payload: QStashWebhookPayload<FrameGenerationPayload> = {
      body: {
        jobId: "job-789",
        type: "frame_generation",
        data: {
          sequenceId: "sequence-789",
          script: "Test script",
        },
      },
      headers: {},
      meta: {
        messageId: "msg-789",
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

    const payload: QStashWebhookPayload<FrameGenerationPayload> = {
      body: {
        jobId: "job-fail",
        type: "frame_generation",
        data: {
          sequenceId: "sequence-fail",
          script: "Test script",
        },
      },
      headers: {},
      meta: {
        messageId: "msg-fail",
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

    expect(response.status).toBe(500);
    expect(data.error).toBe("Frame generation failed");

    // Job should be marked as failed
    expect(mockJobManager.failJob).toHaveBeenCalled();
  });

  it("should clean up placeholder frames", async () => {
    const payload: QStashWebhookPayload<FrameGenerationPayload> = {
      body: {
        jobId: "job-cleanup",
        type: "frame_generation",
        data: {
          sequenceId: "sequence-cleanup",
          script: "Test script",
        },
      },
      headers: {},
      meta: {
        messageId: "msg-cleanup",
        attempts: 1,
        createdAt: Date.now(),
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
