/**
 * Tests for motion generation service
 *
 * Run with: bun test --preload ./__mocks__/fal-client.mock.ts motion.service.test.ts
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { IMAGE_TO_VIDEO_MODELS } from '../ai/models';
import {
  mockCreateFalClient,
  mockSubscribe,
} from './__mocks__/fal-client.mock';
import { generateMotionForFrame } from './motion.service';

describe('Motion Service', () => {
  beforeEach(() => {
    // Clear mocks before each test
    mockSubscribe.mockClear();
    mockCreateFalClient.mockClear();
  });

  describe('generateMotionForFrame', () => {
    it('should generate motion with SVD-LCM model', async () => {
      const mockVideoUrl = 'https://example.com/generated-video.mp4';

      mockSubscribe.mockResolvedValue({
        data: {
          video: {
            url: mockVideoUrl,
          },
        },
        requestId: 'test-request-id',
      });

      const result = await generateMotionForFrame({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'A person walking',
        model: 'svd_lcm',
        duration: 2,
        fps: 7,
        motionBucket: 127,
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBe(mockVideoUrl);
      expect(result.requestId).toBe('test-request-id');
      expect(result.metadata).toMatchObject({
        model: 'fal-ai/fast-svd-lcm',
        provider: 'stability',
        duration: 2, // User-provided duration (validated against max)
        fps: 7,
        motionBucket: 127,
        cost: 0.1,
      });

      expect(mockSubscribe).toHaveBeenCalledWith(
        'fal-ai/fast-svd-lcm',
        expect.objectContaining({
          input: expect.objectContaining({
            image_url: 'https://example.com/image.jpg',
            motion_bucket_id: 127,
            fps: 7,
            cond_aug: 0.02,
            steps: 4,
          }),
          logs: true,
          pollInterval: 5000,
        })
      );
    });

    it('should generate motion with WAN I2V model', async () => {
      const mockVideoUrl = 'https://example.com/wan-video.mp4';

      mockSubscribe.mockResolvedValue({
        data: {
          video: {
            url: mockVideoUrl,
          },
        },
        requestId: 'test-wan-request-id',
      });

      const result = await generateMotionForFrame({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Smooth camera pan',
        model: 'wan_i2v',
        duration: 3,
        fps: 24,
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBe(mockVideoUrl);
      expect(result.metadata?.model).toBe('fal-ai/wan-i2v');
      expect(result.metadata?.cost).toBe(0.3);
    });

    it('should generate motion with Seedance Pro model', async () => {
      const mockVideoUrl = 'https://example.com/seedance-video.mp4';

      mockSubscribe.mockResolvedValue({
        data: {
          video: {
            url: mockVideoUrl,
          },
        },
        requestId: 'test-seedance-request-id',
      });

      const result = await generateMotionForFrame({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Dynamic action sequence',
        model: 'seedance_v1_pro',
        duration: 5,
        fps: 25,
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBe(mockVideoUrl);
      expect(mockSubscribe).toHaveBeenCalledWith(
        'fal-ai/bytedance/seedance/v1/pro/image-to-video',
        expect.objectContaining({
          input: expect.objectContaining({
            prompt: 'Dynamic action sequence',
            image_url: 'https://example.com/image.jpg',
            aspect_ratio: 'auto',
            resolution: '1080p',
            duration: '5',
            camera_fixed: false,
            enable_safety_checker: true,
          }),
          logs: true,
          pollInterval: 5000,
        })
      );
    });

    it('should handle generation failure', async () => {
      mockSubscribe.mockRejectedValue(new Error('API error'));

      const result = await generateMotionForFrame({
        imageUrl: 'https://example.com/image.jpg',
        prompt: '', // Required even though SVD doesn't use it
        model: 'svd_lcm',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API error');
      expect(result.videoUrl).toBeUndefined();
    });

    it('should handle missing video URL in response', async () => {
      mockSubscribe.mockResolvedValue({
        data: {
          // No video field
          error: 'Something went wrong',
        },
        requestId: 'test-error-id',
      });

      const result = await generateMotionForFrame({
        imageUrl: 'https://example.com/image.jpg',
        prompt: '', // Required even though SVD doesn't use it
        model: 'svd_lcm',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No video URL returned');
    });

    it('should generate motion with Kling O1 model', async () => {
      const mockVideoUrl = 'https://example.com/kling-o1-video.mp4';

      mockSubscribe.mockResolvedValue({
        data: {
          video: {
            url: mockVideoUrl,
          },
        },
        requestId: 'test-kling-o1-request-id',
      });

      const result = await generateMotionForFrame({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Smooth camera movement',
        model: 'kling_o1',
        duration: 10,
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBe(mockVideoUrl);
      expect(result.metadata?.model).toBe(
        'fal-ai/kling-video/o1/image-to-video'
      );
      expect(result.metadata?.provider).toBe('kling');

      expect(mockSubscribe).toHaveBeenCalledWith(
        'fal-ai/kling-video/o1/image-to-video',
        expect.objectContaining({
          input: expect.objectContaining({
            prompt: 'Smooth camera movement',
            image_url: 'https://example.com/image.jpg',
            duration: '10', // Should be string
            cfg_scale: 0.5,
            negative_prompt: 'blur, distort, and low quality',
          }),
          logs: true,
          pollInterval: 5000,
        })
      );
    });
  });

  describe('Model configurations', () => {
    it('should have correct model configurations', () => {
      expect(IMAGE_TO_VIDEO_MODELS.svd_lcm).toMatchObject({
        id: 'fal-ai/fast-svd-lcm',
        name: 'Fast Motion (SVD-LCM)',
        provider: 'stability',
        capabilities: {
          supportsPrompt: false,
          supportsAudio: false,
          maxDuration: 2.5,
          defaultDuration: 2.5,
          fpsRange: { min: 1, max: 25, default: 10 },
          fixedFrameCount: 25,
        },
        pricing: {
          estimatedCost: 0.1,
          unit: 'frame',
        },
        performance: {
          estimatedGenerationTime: 5,
          quality: 'good',
        },
      });

      expect(IMAGE_TO_VIDEO_MODELS.wan_i2v).toMatchObject({
        id: 'fal-ai/wan-i2v',
        name: 'Balanced Motion (WAN 2.1)',
        provider: 'minimax',
        capabilities: {
          defaultDuration: 5.06,
          fpsRange: { min: 5, max: 24, default: 16 },
        },
        pricing: {
          estimatedCost: 0.3,
        },
        performance: {
          quality: 'better',
        },
      });

      expect(IMAGE_TO_VIDEO_MODELS.seedance_v1_pro).toMatchObject({
        id: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
        provider: 'seedance',
        capabilities: {
          defaultDuration: 5,
        },
        pricing: {
          estimatedCost: 0.5,
        },
        performance: {
          quality: 'best',
        },
      });

      expect(IMAGE_TO_VIDEO_MODELS.kling_o1).toMatchObject({
        id: 'fal-ai/kling-video/o1/image-to-video',
        name: 'Kling O1 (Omni)',
        provider: 'kling',
        capabilities: {
          supportsPrompt: true,
          supportsAudio: false,
          maxDuration: 10,
          defaultDuration: 5,
          requiresStringDuration: true,
        },
        pricing: {
          estimatedCost: 0.35,
          unit: 'video',
        },
        performance: {
          quality: 'best',
        },
      });
    });
  });
});
