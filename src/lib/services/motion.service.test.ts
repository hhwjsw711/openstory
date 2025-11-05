/**
 * Tests for motion generation service
 *
 * Run with: bun test --preload ./__mocks__/fal-client.mock.ts motion.service.test.ts
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import {
  mockSubscribe,
  mockCreateFalClient,
} from './__mocks__/fal-client.mock';
import {
  estimateMotionGeneration,
  generateMotionForFrame,
  IMAGE_TO_VIDEO_MODELS,
  selectMotionModel,
} from './motion.service';

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
  });

  describe('selectMotionModel', () => {
    it('should select fast model for speed priority', () => {
      const model = selectMotionModel({ speed: 'fast' });
      expect(model).toBe('svd_lcm');
    });

    it('should select quality model for quality priority', () => {
      const model = selectMotionModel({ speed: 'quality', budget: 'high' });
      expect(model).toBe('veo2_i2v');
    });

    it('should select balanced model for medium budget', () => {
      const model = selectMotionModel({ speed: 'balanced', budget: 'medium' });
      expect(model).toBe('wan_i2v');
    });

    it('should respect budget constraints', () => {
      const lowBudget = selectMotionModel({ speed: 'quality', budget: 'low' });
      expect(lowBudget).toBe('seedance_v1_pro');

      const highBudget = selectMotionModel({
        speed: 'balanced',
        budget: 'high',
      });
      expect(highBudget).toBe('veo2_i2v');
    });

    it('should default to wan_i2v for balanced approach', () => {
      const model = selectMotionModel({});
      expect(model).toBe('wan_i2v');
    });
  });

  describe('estimateMotionGeneration', () => {
    it('should calculate costs for SVD-LCM', () => {
      const estimate = estimateMotionGeneration(10, 'svd_lcm');

      expect(estimate.totalCost).toBe(1.0); // 10 frames * $0.10
      expect(estimate.totalTime).toBe(50); // 10 frames * 5 seconds
      expect(estimate.perFrameCost).toBe(0.1);
      expect(estimate.perFrameTime).toBe(5);
    });

    it('should calculate costs for WAN I2V', () => {
      const estimate = estimateMotionGeneration(10, 'wan_i2v');

      expect(estimate.totalCost).toBe(3.0); // 10 frames * $0.30
      expect(estimate.totalTime).toBe(100); // 10 frames * 10 seconds
      expect(estimate.perFrameCost).toBe(0.3);
      expect(estimate.perFrameTime).toBe(10);
    });

    it('should calculate costs for Seedance Pro', () => {
      const estimate = estimateMotionGeneration(10, 'seedance_v1_pro');

      expect(estimate.totalCost).toBe(5.0); // 10 frames * $0.50
      expect(estimate.totalTime).toBe(120); // 10 frames * 12 seconds
      expect(estimate.perFrameCost).toBe(0.5);
      expect(estimate.perFrameTime).toBe(12);
    });

    it('should default to SVD-LCM if no model specified', () => {
      const estimate = estimateMotionGeneration(5);

      expect(estimate.totalCost).toBe(0.5); // 5 frames * $0.10 (SVD-LCM)
      expect(estimate.totalTime).toBe(25); // 5 frames * 5 seconds
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
    });
  });
});
