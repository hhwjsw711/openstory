/**
 * Tests for frame generation actions
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { GenerateFramesInput } from "../index";
import { generateFramesAction } from "../index";

// Mock dependencies - create function so we can reset for each test
const createMockServerClient = () =>
  mock(() => {
    let _callCount = 0;
    return {
      auth: {
        getUser: mock(() =>
          Promise.resolve({
            data: {
              user: {
                id: "123e4567-e89b-12d3-a456-426614174001",
                email: "test@example.com",
              },
            },
          }),
        ),
      },
      from: mock((table: string) => {
        _callCount++;
        if (table === "sequences") {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(() =>
                  Promise.resolve({
                    data: {
                      id: "123e4567-e89b-12d3-a456-426614174000",
                      team_id: "123e4567-e89b-12d3-a456-426614174002",
                      name: "Test Sequence",
                      script: "This is a test script for frame generation.",
                      style_id: "style-123",
                      styles: {
                        metadata: { theme: "dark" },
                      },
                    },
                    error: null,
                  }),
                ),
              })),
            })),
          };
        } else if (table === "team_members") {
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
        }
        return {
          select: mock(() => ({
            eq: mock(() => ({
              single: mock(() =>
                Promise.resolve({
                  data: null,
                  error: null,
                }),
              ),
            })),
          })),
        };
      }),
    };
  });

let mockCreateServerClient = createMockServerClient();

const mockCreateAdminClient = mock(() => ({
  from: mock(() => ({
    insert: mock(() =>
      Promise.resolve({
        data: null,
        error: null,
      }),
    ),
  })),
}));

const mockJobManager = {
  createJob: mock(() =>
    Promise.resolve({
      id: "job-123",
      type: "frame_generation",
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  ),
};

const mockQStashClient = {
  publishFrameGenerationJob: mock(() =>
    Promise.resolve({
      messageId: "msg-123",
      deduplicated: false,
    }),
  ),
};

// Module mocks
mock.module("@/lib/supabase/server", () => ({
  createServerClient: mockCreateServerClient,
  createAdminClient: mockCreateAdminClient,
}));

mock.module("@/lib/qstash/job-manager", () => ({
  getJobManager: () => mockJobManager,
}));

mock.module("@/lib/qstash/client", () => ({
  getQStashClient: () => mockQStashClient,
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(() => {}),
}));

describe("generateFramesAction", () => {
  beforeEach(() => {
    // Reset mocks for each test
    mockCreateServerClient = createMockServerClient();
    mockCreateAdminClient.mockClear();
    mockJobManager.createJob.mockClear();

    // Reset QStash client mock to success state
    mockQStashClient.publishFrameGenerationJob = mock(() =>
      Promise.resolve({
        messageId: "msg-123",
        deduplicated: false,
      }),
    );

    // Reset the module mocks to use fresh instances
    mock.module("@/lib/supabase/server", () => ({
      createServerClient: mockCreateServerClient,
      createAdminClient: mockCreateAdminClient,
    }));
  });

  it("should successfully generate frames with basic input", async () => {
    const input: GenerateFramesInput = {
      sequenceId: "123e4567-e89b-12d3-a456-426614174000",
    };

    const result = await generateFramesAction(input);

    expect(result.success).toBe(true);
    expect(result.jobId).toBe("job-123");
    expect(result.message).toBeDefined();
    expect(result.error).toBeUndefined();

    // Verify job was created
    expect(mockJobManager.createJob).toHaveBeenCalledTimes(1);
    expect(mockJobManager.createJob).toHaveBeenCalledWith({
      type: "frame_generation",
      payload: expect.objectContaining({
        sequenceId: input.sequenceId,
      }),
      userId: "123e4567-e89b-12d3-a456-426614174001",
      teamId: "123e4567-e89b-12d3-a456-426614174002",
    });

    // Verify QStash job was published
    expect(mockQStashClient.publishFrameGenerationJob).toHaveBeenCalledTimes(1);
  });

  it("should generate frames with custom options", async () => {
    const input: GenerateFramesInput = {
      sequenceId: "123e4567-e89b-12d3-a456-426614174000",
      options: {
        framesPerScene: 3,
        generateThumbnails: true,
        aiProvider: "openai",
      },
    };

    const result = await generateFramesAction(input);

    expect(result.success).toBe(true);
    expect(result.jobId).toBe("job-123");
  });

  it("should handle sequence not found error", async () => {
    // Create a new mock for this specific test
    const mockSequenceNotFound = mock(() => ({
      auth: {
        getUser: mock(() =>
          Promise.resolve({
            data: {
              user: {
                id: "123e4567-e89b-12d3-a456-426614174001",
                email: "test@example.com",
              },
            },
          }),
        ),
      },
      from: mock((table: string) => {
        if (table === "sequences") {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(() =>
                  Promise.resolve({
                    data: null,
                    error: { message: "Not found" },
                  }),
                ),
              })),
            })),
          };
        }
        return {
          select: mock(() => ({
            eq: mock(() => ({
              eq: mock(() => ({
                single: mock(() =>
                  Promise.resolve({
                    data: null,
                    error: null,
                  }),
                ),
              })),
            })),
          })),
        };
      }),
    }));

    // Override the module mock for this test
    mock.module("@/lib/supabase/server", () => ({
      createServerClient: mockSequenceNotFound,
      createAdminClient: mockCreateAdminClient,
    }));

    // Re-import the module to use the new mock
    const { generateFramesAction: testAction } = await import("../index");

    const input: GenerateFramesInput = {
      sequenceId: "223e4567-e89b-12d3-a456-426614174999",
    };

    const result = await testAction(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Sequence not found");
    expect(result.jobId).toBeUndefined();
  });

  it("should handle permission denied error", async () => {
    // Create a new mock for permission denied test
    const mockPermissionDenied = mock(() => ({
      auth: {
        getUser: mock(() =>
          Promise.resolve({
            data: {
              user: {
                id: "123e4567-e89b-12d3-a456-426614174001",
                email: "test@example.com",
              },
            },
          }),
        ),
      },
      from: mock((table: string) => {
        if (table === "sequences") {
          // Sequence exists
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(() =>
                  Promise.resolve({
                    data: {
                      id: "123e4567-e89b-12d3-a456-426614174000",
                      team_id: "123e4567-e89b-12d3-a456-426614174002",
                      name: "Test Sequence",
                      script: "Test script",
                      style_id: "style-123",
                    },
                    error: null,
                  }),
                ),
              })),
            })),
          };
        } else if (table === "team_members") {
          // User not a team member
          return {
            select: mock(() => ({
              eq: mock(() => ({
                eq: mock(() => ({
                  single: mock(() =>
                    Promise.resolve({
                      data: null,
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          };
        }
        return {
          select: mock(() => ({
            eq: mock(() => ({
              single: mock(() =>
                Promise.resolve({
                  data: null,
                  error: null,
                }),
              ),
            })),
          })),
        };
      }),
    }));

    // Override the module mock for this test
    mock.module("@/lib/supabase/server", () => ({
      createServerClient: mockPermissionDenied,
      createAdminClient: mockCreateAdminClient,
    }));

    // Re-import the module to use the new mock
    const { generateFramesAction: testAction } = await import("../index");

    const input: GenerateFramesInput = {
      sequenceId: "123e4567-e89b-12d3-a456-426614174000",
    };

    const result = await testAction(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "You don't have permission to generate frames for this sequence",
    );
  });

  it("should handle custom options", async () => {
    const input: GenerateFramesInput = {
      sequenceId: "123e4567-e89b-12d3-a456-426614174000",
      options: {
        framesPerScene: 7,
        generateDescriptions: true,
        aiProvider: "anthropic",
      },
    };

    const result = await generateFramesAction(input);

    expect(result.success).toBe(true);

    // Verify options were passed to job
    expect(mockJobManager.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          options: input.options,
        }),
      }),
    );
  });

  it("should handle QStash publishing error", async () => {
    // Mock QStash error
    mockQStashClient.publishFrameGenerationJob = mock(() =>
      Promise.reject(new Error("QStash service unavailable")),
    );

    const input: GenerateFramesInput = {
      sequenceId: "123e4567-e89b-12d3-a456-426614174000",
    };

    const result = await generateFramesAction(input);

    expect(result.success).toBe(false);
    expect(result.error).toContain("QStash service unavailable");
  });

  it("should handle options for frame generation", async () => {
    const input: GenerateFramesInput = {
      sequenceId: "123e4567-e89b-12d3-a456-426614174000",
      options: {
        framesPerScene: 2,
      },
    };

    const result = await generateFramesAction(input);

    // Debug: log the result to see why it's failing
    if (!result.success) {
      console.error("Test failed with error:", result.error);
    }

    expect(result.success).toBe(true);

    // The implementation no longer creates placeholder frames,
    // it queues the job and lets the webhook handle everything
    expect(mockQStashClient.publishFrameGenerationJob).toHaveBeenCalled();
    expect(result.jobId).toBe("job-123");
  });

  afterEach(() => {
    mock.restore();
  });
});
