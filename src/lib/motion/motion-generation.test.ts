import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { IMAGE_TO_VIDEO_MODELS } from '../ai/models';
import { micros } from '../billing/money';
import {
  mockGenerateVideo,
  mockGetVideoJobStatus,
} from './__mocks__/fal-client.mock';

// Mock DB + env so api-key resolution falls through to platform key
mock.module('#db-client', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
  }),
}));

mock.module('#env', () => ({
  getEnv: () => ({ FAL_KEY: 'test-fal-key', OPENROUTER_KEY: 'test-or-key' }),
}));

const { generateMotionForFrame } = await import('./motion-generation');

describe('Motion Service', () => {
  beforeEach(() => {
    mockGenerateVideo.mockClear();
    mockGetVideoJobStatus.mockClear();
  });

  describe('generateMotionForFrame', () => {
    it('should generate motion with Kling v3 Pro model', async () => {
      const mockVideoUrl = 'https://example.com/kling-v3-video.mp4';

      mockGenerateVideo.mockResolvedValue({
        jobId: 'test-kling-v3-request-id',
        model: 'fal-ai/kling-video/v3/pro/image-to-video',
      });

      mockGetVideoJobStatus.mockResolvedValue({
        status: 'completed',
        url: mockVideoUrl,
      });

      const result = await generateMotionForFrame({
        // scopedDb not passed — falls through to platform FAL_KEY
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
      expect(result.metadata?.cost).toBe(micros(840_000)); // 140_000 micros/s * 1.2 (audio) * 5s

      expect(mockGenerateVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'A person walking',
          modelOptions: expect.objectContaining({
            start_image_url: 'https://example.com/image.jpg',
            duration: '5',
            cfg_scale: 0.5,
            negative_prompt: 'blur, distort, and low quality',
          }),
        })
      );
    });

    it('should generate motion with Seedance Pro model', async () => {
      const mockVideoUrl = 'https://example.com/seedance-video.mp4';

      mockGenerateVideo.mockResolvedValue({
        jobId: 'test-seedance-request-id',
        model: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
      });

      mockGetVideoJobStatus.mockResolvedValue({
        status: 'completed',
        url: mockVideoUrl,
      });

      const result = await generateMotionForFrame({
        // scopedDb not passed — falls through to platform FAL_KEY
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Dynamic action sequence',
        model: 'seedance_v1_pro',
        duration: 5,
        fps: 25,
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBe(mockVideoUrl);

      expect(mockGenerateVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Dynamic action sequence',
          modelOptions: expect.objectContaining({
            image_url: 'https://example.com/image.jpg',
            aspect_ratio: 'auto',
            resolution: '1080p',
            duration: '5',
            camera_fixed: false,
            enable_safety_checker: true,
          }),
        })
      );
    });

    it('should handle generation failure', async () => {
      mockGenerateVideo.mockRejectedValue(new Error('API error'));

      expect(
        generateMotionForFrame({
          imageUrl: 'https://example.com/image.jpg',
          prompt: 'Test prompt',
          model: 'kling_v3_pro',
        })
      ).rejects.toThrow('API error');
    });

    it('should handle failed video job status', async () => {
      mockGenerateVideo.mockResolvedValue({
        jobId: 'test-failed-id',
        model: 'fal-ai/kling-video/v3/pro/image-to-video',
      });

      mockGetVideoJobStatus.mockResolvedValue({
        status: 'failed',
        error: 'Generation failed on provider side',
      });

      expect(
        generateMotionForFrame({
          imageUrl: 'https://example.com/image.jpg',
          prompt: 'Test prompt',
          model: 'kling_v3_pro',
        })
      ).rejects.toThrow('Generation failed on provider side');
    });

    it('should generate motion with Kling O1 model', async () => {
      const mockVideoUrl = 'https://example.com/kling-o1-video.mp4';

      mockGenerateVideo.mockResolvedValue({
        jobId: 'test-kling-o1-request-id',
        model: 'fal-ai/kling-video/o1/image-to-video',
      });

      mockGetVideoJobStatus.mockResolvedValue({
        status: 'completed',
        url: mockVideoUrl,
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

      expect(mockGenerateVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Smooth camera movement',
          modelOptions: expect.objectContaining({
            start_image_url: 'https://example.com/image.jpg', // O1 uses start_image_url
            duration: '10', // Should be string
            cfg_scale: 0.5,
            negative_prompt: 'blur, distort, and low quality',
            generate_audio: false, // O1 doesn't support audio
          }),
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
        performance: {
          quality: 'best',
        },
      });
    });
  });
});
