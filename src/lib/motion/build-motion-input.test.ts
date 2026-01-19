/**
 * Tests for buildMotionInput function
 */

import { describe, expect, it } from 'bun:test';
import { buildMotionInput } from './motion-generation';

describe('buildMotionInput', () => {
  describe('Kling models', () => {
    it('should build input for kling_v2_6_pro', () => {
      const { input, modelConfig } = buildMotionInput({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Camera pan left',
        model: 'kling_v2_6_pro',
        duration: 5,
      });

      expect(modelConfig.id).toBe('fal-ai/kling-video/v2.6/pro/image-to-video');
      expect(modelConfig.provider).toBe('kling');
      expect(input).toMatchObject({
        prompt: 'Camera pan left',
        image_url: 'https://example.com/image.jpg',
        duration: '5', // Kling uses string duration
        cfg_scale: 0.5,
        negative_prompt: 'blur, distort, and low quality',
        generate_audio: true, // v2.6 supports audio
      });
    });

    it('should build input for kling_v2_6_pro_no_audio', () => {
      const { input, modelConfig } = buildMotionInput({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Smooth motion',
        model: 'kling_v2_6_pro_no_audio',
      });

      expect(modelConfig.id).toBe('fal-ai/kling-video/v2.6/pro/image-to-video');
      expect(input.generate_audio).toBe(false);
    });

    it('should build input for kling_o1 with start_image_url', () => {
      const { input, modelConfig } = buildMotionInput({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Dynamic motion',
        model: 'kling_o1',
      });

      expect(modelConfig.id).toBe('fal-ai/kling-video/o1/image-to-video');
      expect(input).toMatchObject({
        start_image_url: 'https://example.com/image.jpg', // O1 uses start_image_url
        prompt: 'Dynamic motion',
      });
      expect(input.image_url).toBeUndefined();
    });
  });

  describe('Seedance model', () => {
    it('should build input for seedance_v1_pro', () => {
      const { input, modelConfig } = buildMotionInput({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Action sequence',
        model: 'seedance_v1_pro',
        duration: 8,
        aspectRatio: '16:9',
      });

      expect(modelConfig.id).toBe(
        'fal-ai/bytedance/seedance/v1/pro/image-to-video'
      );
      expect(modelConfig.provider).toBe('seedance');
      expect(input).toMatchObject({
        prompt: 'Action sequence',
        image_url: 'https://example.com/image.jpg',
        aspect_ratio: '16:9',
        resolution: '1080p',
        duration: '8',
        camera_fixed: false,
        enable_safety_checker: true,
      });
      expect(input.seed).toBeDefined();
    });
  });

  describe('Google Veo models', () => {
    it('should build input for veo3', () => {
      const { input, modelConfig } = buildMotionInput({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Cinematic scene',
        model: 'veo3',
      });

      expect(modelConfig.id).toBe('fal-ai/veo3');
      expect(modelConfig.provider).toBe('google');
      expect(input).toMatchObject({
        prompt: 'Cinematic scene',
        image_url: 'https://example.com/image.jpg',
        generate_audio: true,
        resolution: '1080p',
        duration: '8s', // Veo uses "Xs" format
      });
    });

    it('should snap duration to supported values for veo3_1', () => {
      const { input } = buildMotionInput({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Scene',
        model: 'veo3_1',
        duration: 5, // Will snap to closest supported (4 or 6)
      });

      // Should snap to 4 or 6
      expect(['4s', '6s']).toContain(String(input.duration));
    });
  });

  describe('OpenAI Sora model', () => {
    it('should build input for sora_2', () => {
      const { input, modelConfig } = buildMotionInput({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Creative video',
        model: 'sora_2',
        duration: 8,
      });

      expect(modelConfig.id).toBe('fal-ai/sora-2/image-to-video');
      expect(modelConfig.provider).toBe('openai');
      expect(input).toMatchObject({
        prompt: 'Creative video',
        image_url: 'https://example.com/image.jpg',
        duration: 8, // Sora uses integer
        resolution: '720p',
      });
    });
  });

  describe('Luma model', () => {
    // Note: Luma is defined in PROVIDER_INPUT_BUILDERS but not in IMAGE_TO_VIDEO_MODEL_KEYS
    // This test documents the expected behavior if luma is added
  });

  describe('Default values', () => {
    it('should use default model when not specified', () => {
      const { modelConfig } = buildMotionInput({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Test',
      });

      // Default should be kling_v2_6_pro
      expect(modelConfig.id).toBe('fal-ai/kling-video/v2.6/pro/image-to-video');
    });

    it('should use default duration from model config', () => {
      const { input, modelConfig } = buildMotionInput({
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'Test',
        model: 'seedance_v1_pro',
        // No duration specified
      });

      expect(input.duration).toBe(
        String(modelConfig.capabilities.defaultDuration)
      );
    });
  });

  describe('Error handling', () => {
    it('should throw for invalid model', () => {
      expect(() =>
        buildMotionInput({
          imageUrl: 'https://example.com/image.jpg',
          prompt: 'Test',
          // @ts-expect-error - testing invalid model
          model: 'invalid_model',
        })
      ).toThrow('Invalid model');
    });
  });
});
