/**
 * Tests for motion generation service
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Json } from "@/types/database";
import {
  estimateMotionGeneration,
  generateMotionForFrame,
  MOTION_MODELS,
  selectMotionModel,
} from "./motion.service";

// Mock the module once at the top level
mock.module("@/lib/ai/fal-client", () => ({
  fal: {
    run: mock(),
  },
}));

describe("Motion Service", () => {
  beforeEach(async () => {
    // Clear mocks before each test
    const { fal } = await import("@/lib/ai/fal-client");
    (fal.run as any).mockClear();
  });

  afterEach(() => {
    // Restore mocks after each test
    mock.restore();
  });

  describe("generateMotionForFrame", () => {
    it("should generate motion with SVD-LCM model", async () => {
      const mockVideoUrl = "https://example.com/generated-video.mp4";

      const { fal } = await import("@/lib/ai/fal-client");
      (fal.run as any).mockResolvedValue({
        video: {
          url: mockVideoUrl,
        },
      });

      const result = await generateMotionForFrame({
        imageUrl: "https://example.com/image.jpg",
        prompt: "A person walking",
        model: "svd_lcm",
        duration: 2,
        fps: 7,
        motionBucket: 127,
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBe(mockVideoUrl);
      expect(result.metadata).toMatchObject({
        model: "fal-ai/fast-svd-lcm",
        duration: 2,
        fps: 7,
        motionBucket: 127,
        totalFrames: 14,
        cost: 0.1,
      });

      expect(fal.run).toHaveBeenCalledWith("fal-ai/fast-svd-lcm", {
        input: expect.objectContaining({
          image_url: "https://example.com/image.jpg",
          motion_bucket_id: 127,
          frames_per_second: 7,
        }),
      });
    });

    it("should generate motion with WAN I2V model", async () => {
      const mockVideoUrl = "https://example.com/wan-video.mp4";

      const { fal } = await import("@/lib/ai/fal-client");
      (fal.run as any).mockResolvedValue({
        video: {
          url: mockVideoUrl,
        },
      });

      const result = await generateMotionForFrame({
        imageUrl: "https://example.com/image.jpg",
        prompt: "Smooth camera pan",
        model: "wan_i2v",
        duration: 3,
        fps: 24,
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBe(mockVideoUrl);
      expect(result.metadata?.model).toBe("fal-ai/wan-i2v");
      expect(result.metadata?.cost).toBe(0.3);
    });

    it("should generate motion with Seedance Pro model", async () => {
      const mockVideoUrl = "https://example.com/seedance-video.mp4";

      const { fal } = await import("@/lib/ai/fal-client");
      (fal.run as any).mockResolvedValue({
        video: {
          url: mockVideoUrl,
        },
      });

      const result = await generateMotionForFrame({
        imageUrl: "https://example.com/image.jpg",
        prompt: "Dynamic action sequence",
        model: "seedance_v1_pro",
        duration: 5,
        fps: 25,
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBe(mockVideoUrl);
      expect(fal.run).toHaveBeenCalledWith(
        "fal-ai/bytedance/seedance/v1/pro/image-to-video",
        {
          input: expect.objectContaining({
            prompt: expect.stringContaining("Dynamic action sequence"),
            image_url: "https://example.com/image.jpg",
            aspect_ratio: "16:9",
            resolution: "1080p",
          }),
        },
      );
    });

    it("should enhance prompt based on style stack", async () => {
      const { fal } = await import("@/lib/ai/fal-client");
      (fal.run as any).mockResolvedValue({
        video: {
          url: "https://example.com/video.mp4",
        },
      });

      const styleStack: Json = {
        genre: "action",
        mood: "exciting",
      };

      await generateMotionForFrame({
        imageUrl: "https://example.com/image.jpg",
        prompt: "Character movement",
        model: "svd_lcm",
        styleStack,
      });

      // For Seedance Pro, the prompt should be enhanced
      await generateMotionForFrame({
        imageUrl: "https://example.com/image.jpg",
        prompt: "Character movement",
        model: "seedance_v1_pro",
        styleStack,
      });

      const seedanceCall = (fal.run as any).mock.calls.find(
        (call: any[]) =>
          call[0] === "fal-ai/bytedance/seedance/v1/pro/image-to-video",
      );

      expect(seedanceCall).toBeDefined();
      const prompt = seedanceCall[1].input.prompt;
      // The enhanced prompt should be a complete concatenation
      expect(prompt).toBe(
        "Character movement, dynamic camera movement, fast-paced action, energetic motion, quick cuts, maintain visual consistency, smooth transitions, professional cinematography",
      );
    });

    it("should handle generation failure", async () => {
      const { fal } = await import("@/lib/ai/fal-client");
      (fal.run as any).mockRejectedValue(new Error("API error"));

      const result = await generateMotionForFrame({
        imageUrl: "https://example.com/image.jpg",
        model: "svd_lcm",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("API error");
      expect(result.videoUrl).toBeUndefined();
    });

    it("should handle missing video URL in response", async () => {
      const { fal } = await import("@/lib/ai/fal-client");
      (fal.run as any).mockResolvedValue({
        // No video field
        error: "Something went wrong",
      });

      const result = await generateMotionForFrame({
        imageUrl: "https://example.com/image.jpg",
        model: "svd_lcm",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No video URL returned");
    });
  });

  describe("selectMotionModel", () => {
    it("should select fast model for speed priority", () => {
      const model = selectMotionModel({ speed: "fast" });
      expect(model).toBe("svd_lcm");
    });

    it("should select quality model for quality priority", () => {
      const model = selectMotionModel({ speed: "quality", budget: "high" });
      expect(model).toBe("veo2_i2v");
    });

    it("should select balanced model for medium budget", () => {
      const model = selectMotionModel({ speed: "balanced", budget: "medium" });
      expect(model).toBe("wan_i2v");
    });

    it("should respect budget constraints", () => {
      const lowBudget = selectMotionModel({ speed: "quality", budget: "low" });
      expect(lowBudget).toBe("seedance_v1_pro");

      const highBudget = selectMotionModel({
        speed: "balanced",
        budget: "high",
      });
      expect(highBudget).toBe("veo2_i2v");
    });

    it("should default to wan_i2v for balanced approach", () => {
      const model = selectMotionModel({});
      expect(model).toBe("wan_i2v");
    });
  });

  describe("estimateMotionGeneration", () => {
    it("should calculate costs for SVD-LCM", () => {
      const estimate = estimateMotionGeneration(10, "svd_lcm");

      expect(estimate.totalCost).toBe(1.0); // 10 frames * $0.10
      expect(estimate.totalTime).toBe(50); // 10 frames * 5 seconds
      expect(estimate.perFrameCost).toBe(0.1);
      expect(estimate.perFrameTime).toBe(5);
    });

    it("should calculate costs for WAN I2V", () => {
      const estimate = estimateMotionGeneration(10, "wan_i2v");

      expect(estimate.totalCost).toBe(3.0); // 10 frames * $0.30
      expect(estimate.totalTime).toBe(100); // 10 frames * 10 seconds
      expect(estimate.perFrameCost).toBe(0.3);
      expect(estimate.perFrameTime).toBe(10);
    });

    it("should calculate costs for Seedance Pro", () => {
      const estimate = estimateMotionGeneration(10, "seedance_v1_pro");

      expect(estimate.totalCost).toBe(5.0); // 10 frames * $0.50
      expect(estimate.totalTime).toBe(120); // 10 frames * 12 seconds
      expect(estimate.perFrameCost).toBe(0.5);
      expect(estimate.perFrameTime).toBe(12);
    });

    it("should default to SVD-LCM if no model specified", () => {
      const estimate = estimateMotionGeneration(5);

      expect(estimate.totalCost).toBe(0.5); // 5 frames * $0.10 (SVD-LCM)
      expect(estimate.totalTime).toBe(25); // 5 frames * 5 seconds
    });
  });

  describe("Model configurations", () => {
    it("should have correct model configurations", () => {
      expect(MOTION_MODELS.svd_lcm).toMatchObject({
        model: "fal-ai/fast-svd-lcm",
        cost: 0.1,
        quality: "good",
        defaultDuration: 2,
      });

      expect(MOTION_MODELS.wan_i2v).toMatchObject({
        model: "fal-ai/wan-i2v",
        cost: 0.3,
        quality: "better",
        defaultDuration: 3,
      });

      expect(MOTION_MODELS.seedance_v1_pro).toMatchObject({
        model: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
        cost: 0.5,
        quality: "best",
        defaultDuration: 5,
      });
    });
  });
});
