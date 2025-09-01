/**
 * Unit tests for job cancellation endpoint
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockJobManager,
  createMockQStashClient,
  createTestJobRow,
  setupVitestMocks,
  testUUIDs,
} from "@/lib/qstash/test-utils";
import { GET, OPTIONS, POST } from "./route";

// Mock dependencies
vi.mock("@/lib/qstash/job-manager", () => ({
  getJobManager: vi.fn(),
}));

vi.mock("@/lib/qstash/client", () => ({
  getQStashClient: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn().mockImplementation((data, options) => ({
      ok: true,
      status: options?.status || 200,
      json: () => Promise.resolve(data),
      ...data,
    })),
  },
}));

// Import mocked functions
import { getQStashClient } from "@/lib/qstash/client";
import { getJobManager } from "@/lib/qstash/job-manager";

describe("Job Cancellation API", () => {
  let mockJobManager: ReturnType<typeof createMockJobManager>;
  let mockQStashClient: ReturnType<typeof createMockQStashClient>;
  let testSetup: ReturnType<typeof setupVitestMocks>;

  beforeEach(() => {
    testSetup = setupVitestMocks();
    mockJobManager = createMockJobManager();
    mockQStashClient = createMockQStashClient();
    vi.mocked(getJobManager).mockReturnValue(mockJobManager as any);
    vi.mocked(getQStashClient).mockReturnValue(mockQStashClient as any);
  });

  afterEach(() => {
    testSetup.restoreConsole();
    testSetup.cleanupEnv();
    vi.clearAllMocks();
  });

  describe("POST /api/v1/jobs/cancel/[id]", () => {
    it("should cancel a pending job successfully", async () => {
      const pendingJob = createTestJobRow({
        id: testUUIDs.job1,
        status: "pending",
      });
      const cancelledJob = {
        ...pendingJob,
        status: "cancelled",
        completed_at: "2024-01-01T00:00:00Z",
      };

      mockJobManager.getJob.mockResolvedValue(pendingJob);
      mockJobManager.cancelJob.mockResolvedValue(cancelledJob);

      const request = {} as NextRequest;
      const _response = await POST(request, {
        params: Promise.resolve({ id: testUUIDs.job1 }),
      });

      expect(mockJobManager.getJob).toHaveBeenCalledWith(testUUIDs.job1);
      expect(mockJobManager.cancelJob).toHaveBeenCalledWith(testUUIDs.job1);
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          jobId: testUUIDs.job1,
          status: "cancelled",
          message: "Job cancelled successfully",
          warnings: expect.arrayContaining([
            expect.stringContaining("QStash message may still be processed"),
          ]),
        }),
      );
    });

    it("should cancel a running job with warning", async () => {
      const runningJob = createTestJobRow({
        id: testUUIDs.job1,
        status: "running",
      });
      const cancelledJob = {
        ...runningJob,
        status: "cancelled",
        completed_at: "2024-01-01T00:00:00Z",
      };

      mockJobManager.getJob.mockResolvedValue(runningJob);
      mockJobManager.cancelJob.mockResolvedValue(cancelledJob);

      const request = {} as NextRequest;
      const _response = await POST(request, {
        params: Promise.resolve({ id: testUUIDs.job1 }),
      });

      expect(mockJobManager.cancelJob).toHaveBeenCalledWith(testUUIDs.job1);
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          warnings: expect.arrayContaining([
            expect.stringContaining("QStash message may still be processed"),
          ]),
        }),
      );
    });

    it("should return conflict for completed job", async () => {
      const completedJob = createTestJobRow({
        id: testUUIDs.job1,
        status: "completed",
      });

      mockJobManager.getJob.mockResolvedValue(completedJob);

      const request = {} as NextRequest;
      const _response = await POST(request, {
        params: Promise.resolve({ id: testUUIDs.job1 }),
      });

      expect(mockJobManager.cancelJob).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          jobId: testUUIDs.job1,
          status: "completed",
          message: "Cannot cancel completed job",
        }),
        { status: 409 },
      );
    });

    it("should return success for already cancelled job", async () => {
      const cancelledJob = createTestJobRow({
        id: testUUIDs.job1,
        status: "cancelled",
      });

      mockJobManager.getJob.mockResolvedValue(cancelledJob);

      const request = {} as NextRequest;
      const _response = await POST(request, {
        params: Promise.resolve({ id: testUUIDs.job1 }),
      });

      expect(mockJobManager.cancelJob).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          jobId: testUUIDs.job1,
          status: "cancelled",
          message: "Job already cancelled",
        }),
      );
    });

    it("should return 404 for non-existent job", async () => {
      mockJobManager.getJob.mockResolvedValue(null);

      const request = {} as NextRequest;
      const _response = await POST(request, {
        params: Promise.resolve({ id: "non-existent" }),
      });

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Failed to cancel job",
          error: expect.objectContaining({
            code: "JOB_NOT_FOUND",
          }),
        }),
        { status: 404 },
      );
    });

    it("should handle invalid job ID", async () => {
      const request = {} as NextRequest;
      const _response = await POST(request, {
        params: Promise.resolve({ id: "" }),
      });

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Failed to cancel job",
          error: expect.objectContaining({
            code: "VALIDATION_ERROR",
          }),
        }),
        { status: 400 },
      );
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database connection failed");
      mockJobManager.getJob.mockRejectedValue(dbError);

      const request = {} as NextRequest;
      const _response = await POST(request, {
        params: Promise.resolve({ id: testUUIDs.job1 }),
      });

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Failed to cancel job",
        }),
        { status: 500 },
      );
    });

    it("should handle failed job cancellation", async () => {
      const failedJob = createTestJobRow({
        id: testUUIDs.job1,
        status: "failed",
      });
      const cancelledJob = {
        ...failedJob,
        status: "cancelled",
      };

      mockJobManager.getJob.mockResolvedValue(failedJob);
      mockJobManager.cancelJob.mockResolvedValue(cancelledJob);

      const request = {} as NextRequest;
      const _response = await POST(request, {
        params: Promise.resolve({ id: testUUIDs.job1 }),
      });

      expect(mockJobManager.cancelJob).toHaveBeenCalledWith(testUUIDs.job1);
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          jobId: testUUIDs.job1,
          status: "cancelled",
          message: "Job cancelled successfully",
        }),
      );
    });
  });

  describe("GET /api/v1/jobs/cancel/[id]", () => {
    it("should return endpoint information", async () => {
      const request = {} as NextRequest;
      const _response = await GET(request, {
        params: Promise.resolve({ id: testUUIDs.job1 }),
      });

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Job cancellation endpoint for job ${testUUIDs.job1}`,
          usage: expect.objectContaining({
            method: "POST",
            description: "Cancel the specified job",
            notes: expect.arrayContaining([
              "Only pending and running jobs can be cancelled",
              "Completed jobs cannot be cancelled",
            ]),
          }),
          jobId: testUUIDs.job1,
        }),
      );
    });
  });

  describe("OPTIONS /api/v1/jobs/cancel/[id]", () => {
    it("should return CORS headers", async () => {
      const _response = await OPTIONS();

      expect(NextResponse.json).toHaveBeenCalledWith(
        {},
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        },
      );
    });
  });
});
