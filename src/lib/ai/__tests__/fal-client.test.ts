/**
 * Tests for FAL AI client
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  FAL_IMAGE_MODELS,
  FAL_VIDEO_MODELS,
  generateImage,
  generateVideo,
  uploadToFal,
} from "../fal-client";

// Mock fetch globally
const mockFetch = mock<typeof fetch>();
global.fetch = mockFetch as unknown as typeof fetch;

describe("FAL Client", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Reset environment variables
    delete process.env.FAL_KEY;
  });

  describe("generateVideo", () => {
    test("should return mock response when no API key is set", async () => {
      const result = await generateVideo({
        prompt: "A beautiful sunset",
      });

      expect(result.video.url).toContain("BigBuckBunny.mp4");
      expect(result.video.content_type).toBe("video/mp4");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should call FAL API for text-to-video when key is set", async () => {
      process.env.FAL_KEY = "test-api-key";

      // Mock submit response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          request_id: "test-request-123",
        }),
      } as Response);

      // Mock status check response (completed)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "completed",
          output: {
            video: {
              url: "https://fal.ai/generated-video.mp4",
              content_type: "video/mp4",
              file_name: "video.mp4",
              file_size: 1234567,
            },
            timings: {
              inference: 12000,
            },
            seed: 42,
          },
        }),
      } as Response);

      const result = await generateVideo({
        model: FAL_VIDEO_MODELS.minimax_hailuo,
        prompt: "A beautiful sunset over the ocean",
        duration: 5,
        aspect_ratio: "16:9",
      });

      // Check API was called correctly
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Check submit call
      const submitCall = mockFetch.mock.calls[0];
      expect(submitCall[0]).toContain("fal-ai/minimax-video/text-to-video");
      expect(submitCall[1]?.method).toBe("POST");
      expect(submitCall[1]?.headers).toEqual(
        expect.objectContaining({
          Authorization: "Key test-api-key",
          "Content-Type": "application/json",
        }),
      );

      // Check result
      expect(result.video.url).toBe("https://fal.ai/generated-video.mp4");
      expect(result.video.file_size).toBe(1234567);
      expect(result.timings?.inference).toBe(12000);
      expect(result.seed).toBe(42);
    });

    test("should call FAL API for image-to-video when image_url is provided", async () => {
      process.env.FAL_KEY = "test-api-key";

      // Mock immediate response (no polling needed)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          video: {
            url: "https://fal.ai/i2v-video.mp4",
            content_type: "video/mp4",
            file_name: "i2v.mp4",
            file_size: 2345678,
          },
          timings: {
            inference: 8000,
          },
        }),
      } as Response);

      const result = await generateVideo({
        model: FAL_VIDEO_MODELS.wan_i2v,
        image_url: "https://example.com/image.jpg",
        prompt: "Make the image come to life",
      });

      const requestBody = JSON.parse(
        (mockFetch.mock.calls[0][1]?.body as string) || "{}",
      );
      expect(requestBody.image_url).toBe("https://example.com/image.jpg");
      expect(requestBody.prompt).toBe("Make the image come to life");

      expect(result.video.url).toBe("https://fal.ai/i2v-video.mp4");
    });

    test("should fall back to mock on API error", async () => {
      process.env.FAL_KEY = "test-api-key";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as Response);

      const result = await generateVideo({
        prompt: "Test video",
      });

      expect(result.video.url).toContain("BigBuckBunny.mp4");
    });

    test("should handle generation failure gracefully", async () => {
      process.env.FAL_KEY = "test-api-key";

      // Mock submit response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          request_id: "test-request-fail",
        }),
      } as Response);

      // Mock status check with failure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "failed",
          error: "Generation failed",
        }),
      } as Response);

      const result = await generateVideo({
        prompt: "Failure test",
      });

      // Should return mock on failure
      expect(result.video.url).toContain("BigBuckBunny.mp4");
    });
  });

  describe("generateImage", () => {
    test("should return mock response when no API key is set", async () => {
      const result = await generateImage({
        prompt: "A majestic mountain",
      });

      expect(result.images[0].url).toContain("BigBuckBunny.jpg");
      expect(result.images[0].content_type).toBe("image/jpeg");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should call FAL API when key is set", async () => {
      process.env.FAL_KEY = "test-api-key";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          images: [
            {
              url: "https://fal.ai/generated-image.jpg",
              content_type: "image/jpeg",
              file_name: "image.jpg",
              file_size: 234567,
              width: 1024,
              height: 1024,
            },
          ],
          timings: {
            inference: 2000,
          },
          seed: 12345,
          prompt: "A majestic mountain",
        }),
      } as Response);

      const result = await generateImage({
        model: FAL_IMAGE_MODELS.flux_schnell,
        prompt: "A majestic mountain",
        image_size: "square",
        num_images: 1,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.images[0].url).toBe("https://fal.ai/generated-image.jpg");
      expect(result.images[0].width).toBe(1024);
      expect(result.timings?.inference).toBe(2000);
    });

    test("should return mock when prompt is empty", async () => {
      const result = await generateImage({ prompt: "" });
      expect(result.images[0].url).toContain("BigBuckBunny.jpg");
    });
  });

  describe("uploadToFal", () => {
    test("should return mock URL when no API key", async () => {
      const result = await uploadToFal(Buffer.from("test"), "test.jpg");
      expect(result).toBe("https://example.com/mock-upload.jpg");
    });

    test("should upload file when API key is set", async () => {
      process.env.FAL_KEY = "test-api-key";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://fal.ai/storage/uploaded-file.jpg",
        }),
      } as Response);

      const buffer = Buffer.from("test image data");
      const result = await uploadToFal(buffer, "test.jpg");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://fal.run/storage/upload",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Key test-api-key",
          }),
        }),
      );

      expect(result).toBe("https://fal.ai/storage/uploaded-file.jpg");
    });

    test("should handle upload errors", async () => {
      process.env.FAL_KEY = "test-api-key";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
      } as Response);

      const buffer = Buffer.from("test");
      await expect(uploadToFal(buffer, "test.jpg")).rejects.toThrow(
        "FAL upload error: 413",
      );
    });
  });

  describe("Model constants", () => {
    test("should have correct video model values", () => {
      expect(FAL_VIDEO_MODELS.minimax_hailuo).toBe(
        "fal-ai/minimax-video/text-to-video",
      );
      expect(FAL_VIDEO_MODELS.wan_i2v).toBe("fal-ai/wan-i2v");
      expect(FAL_VIDEO_MODELS.veo3).toBe("fal-ai/veo3");
    });

    test("should have correct image model values", () => {
      expect(FAL_IMAGE_MODELS.flux_schnell).toBe("fal-ai/flux/schnell");
      expect(FAL_IMAGE_MODELS.flux_pro).toBe("fal-ai/flux-pro");
      expect(FAL_IMAGE_MODELS.sdxl).toBe("fal-ai/fast-sdxl");
    });
  });
});
