/**
 * Tests for motion generation service
 *
 * Run with: bun test --preload ./__mocks__/fal-client.mock.ts motion.service.test.ts
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { IMAGE_TO_VIDEO_MODELS } from '../ai/models';
import { mockSubscribe } from './__mocks__/fal-client.mock';
import { generateMotionForFrame } from './motion-generation';

describe('Motion Service', () => {
  beforeEach(() => {
    // Clear mocks before each test
    mockSubscribe.mockClear();
  });

  describe('generateMotionForFrame', () => {
    it('should generate motion with Kling v3 Pro model', async () => {
      const mockVideoUrl = 'https://example.com/kling-v3-video.mp4';

      mockSubscribe.mockResolvedValue({
        data: {
          video: {
            url: mockVideoUrl,
          },
        },
        requestId: 'test-kling-v3-request-id',
      });

      const result = await generateMotionForFrame({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'A person walking',
        model: 'kling_v3_pro',
        duration: 5,
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBe(mockVideoUrl);
      expect(result.requestId).toBe('test-kling-v3-request-id');
      expect(result.metadata?.model).toBe(
        'fal-ai/kling-video/v3/pro/image-to-video'
      );
      expect(result.metadata?.provider).toBe('kling');
      expect(result.metadata?.duration).toBe(5);
      expect(result.metadata?.fps).toBe(30);
      expect(result.metadata?.cost).toBeCloseTo(1.68, 2); // 0.336 * 5 seconds

      expect(mockSubscribe).toHaveBeenCalledWith(
        'fal-ai/kling-video/v3/pro/image-to-video',
        expect.objectContaining({
          input: expect.objectContaining({
            start_image_url: 'https://example.com/image.jpg',
            prompt: 'A person walking',
            duration: '5',
            cfg_scale: 0.5,
            negative_prompt: 'blur, distort, and low quality',
          }),
          logs: true,
          pollInterval: 5000,
        })
      );
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

      let error: Error | undefined;
      try {
        await generateMotionForFrame({
          imageUrl: 'https://example.com/image.jpg',
          prompt: 'Test prompt',
          model: 'kling_v3_pro',
        });
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
      }
      expect(error?.message).toBe('API error');
    });

    it('should handle missing video URL in response', async () => {
      mockSubscribe.mockResolvedValue({
        data: {
          // No video field
          error: 'Something went wrong',
        },
        requestId: 'test-error-id',
      });

      let error: Error | undefined;
      try {
        await generateMotionForFrame({
          imageUrl: 'https://example.com/image.jpg',
          prompt: 'Test prompt',
          model: 'kling_v3_pro',
        });
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
      }
      expect(error?.message).toBe(
        'No video URL returned from motion generation'
      );
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
            start_image_url: 'https://example.com/image.jpg', // O1 uses start_image_url
            duration: '10', // Should be string
            cfg_scale: 0.5,
            negative_prompt: 'blur, distort, and low quality',
            generate_audio: false, // O1 doesn't support audio
          }),
          logs: true,
          pollInterval: 5000,
        })
      );
    });
  });

  describe('Model configurations', () => {
    it('should have correct model configurations', () => {
      expect(IMAGE_TO_VIDEO_MODELS.kling_v3_pro).toMatchObject({
        id: 'fal-ai/kling-video/v3/pro/image-to-video',
        name: 'Kling v3 Pro',
        provider: 'kling',
        capabilities: {
          supportsPrompt: true,
          supportsAudio: true,
          maxDuration: 15,
          defaultDuration: 5,
          requiresStringDuration: true,
        },
        pricing: {
          pricePerSecond: 0.336,
          currency: 'USD',
          unit: 'seconds',
        },
        performance: {
          estimatedGenerationTime: 20,
          quality: 'best',
        },
      });

      expect(IMAGE_TO_VIDEO_MODELS.seedance_v1_pro).toMatchObject({
        id: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
        provider: 'seedance',
        capabilities: {
          defaultDuration: 5,
        },
        pricing: {
          pricePerSecond: 0.5,
          currency: 'USD',
          unit: 'seconds',
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
          defaultDuration: 10,
          requiresStringDuration: true,
        },
        pricing: {
          pricePerSecond: 0.112,
          currency: 'USD',
          unit: 'seconds',
        },
        performance: {
          quality: 'best',
        },
      });
    });
  });
});
