import { describe, expect, it } from 'bun:test';
import {
  IMAGE_TO_VIDEO_MODELS,
  safeImageToVideoModel,
  type ImageToVideoModel,
} from '../ai/models';
import { buildModelInput } from './build-model-input';
import type { GenerateMotionOptions } from './motion-generation';

const baseOptions: GenerateMotionOptions = {
  prompt: 'Camera dolly forward slowly',
  imageUrl: 'https://example.com/frame.jpg',
  duration: 5,
  aspectRatio: '16:9',
};

function build(
  modelKey: ImageToVideoModel,
  overrides: Partial<GenerateMotionOptions> = {}
): Record<string, unknown> {
  return buildModelInput(
    { ...baseOptions, ...overrides },
    IMAGE_TO_VIDEO_MODELS[modelKey],
    modelKey
  );
}

describe('buildModelInput', () => {
  describe('Kling v3 Pro (audio)', () => {
    it('uses start_image_url (not image_url)', () => {
      const result = build('kling_v3_pro');
      expect(result).toHaveProperty('start_image_url', baseOptions.imageUrl);
      expect(result).not.toHaveProperty('image_url');
    });

    it('formats duration as string', () => {
      const result = build('kling_v3_pro');
      expect(result.duration).toBe('5');
    });

    it('snaps duration to nearest supported value', () => {
      const result = build('kling_v3_pro', { duration: 7.3 });
      expect(result.duration).toBe('7');
    });

    it('applies schema defaults for cfg_scale and negative_prompt', () => {
      const result = build('kling_v3_pro');
      expect(result.cfg_scale).toBe(0.5);
      expect(result.negative_prompt).toBe('blur, distort, and low quality');
    });

    it('sets generate_audio to true from schema default', () => {
      const result = build('kling_v3_pro');
      expect(result.generate_audio).toBe(true);
    });
  });

  describe('Kling v3 Pro no audio', () => {
    it('defaults generate_audio to true (same endpoint as audio variant)', () => {
      const result = build('kling_v3_pro_no_audio');
      expect(result.generate_audio).toBe(true);
    });

    it('still uses start_image_url', () => {
      const result = build('kling_v3_pro_no_audio');
      expect(result).toHaveProperty('start_image_url', baseOptions.imageUrl);
    });
  });

  describe('Kling v2.5 Turbo Pro', () => {
    it('uses image_url (not start_image_url)', () => {
      const result = build('kling_v2_5_turbo_pro');
      expect(result).toHaveProperty('image_url', baseOptions.imageUrl);
      expect(result).not.toHaveProperty('start_image_url');
    });

    it('snaps duration to enum [5, 10]', () => {
      const result = build('kling_v2_5_turbo_pro', { duration: 7 });
      expect(result.duration).toBe('5');
    });
  });

  describe('Veo 3.1 (audio)', () => {
    it('formats duration with s suffix', () => {
      const result = build('veo3_1', { duration: 8 });
      expect(result.duration).toBe('8s');
    });

    it('overrides resolution to 1080p', () => {
      const result = build('veo3_1');
      expect(result.resolution).toBe('1080p');
    });

    it('sets generate_audio to true from schema default', () => {
      const result = build('veo3_1');
      expect(result.generate_audio).toBe(true);
    });

    it('uses image_url', () => {
      const result = build('veo3_1');
      expect(result).toHaveProperty('image_url', baseOptions.imageUrl);
    });
  });

  describe('Sora 2 (audio)', () => {
    it('keeps duration as integer', () => {
      const result = build('sora_2');
      expect(result.duration).toBe(4); // snaps 5 → 4 (nearest in [4, 8, 12, 16, 20])
      expect(typeof result.duration).toBe('number');
    });

    it('uses image_url', () => {
      const result = build('sora_2');
      expect(result).toHaveProperty('image_url', baseOptions.imageUrl);
    });
  });

  describe('Grok Imagine Video', () => {
    it('keeps duration as integer', () => {
      const result = build('grok_imagine_video');
      expect(result.duration).toBe(5);
      expect(typeof result.duration).toBe('number');
    });

    it('uses image_url', () => {
      const result = build('grok_imagine_video');
      expect(result).toHaveProperty('image_url', baseOptions.imageUrl);
    });
  });

  describe('Wan v2.6 Flash', () => {
    it('formats duration as string (fixes previous bug)', () => {
      const result = build('wan_v2_6_flash');
      expect(result.duration).toBe('5');
      expect(typeof result.duration).toBe('string');
    });

    it('applies enable_prompt_expansion default', () => {
      const result = build('wan_v2_6_flash');
      expect(result.enable_prompt_expansion).toBe(true);
    });

    it('uses image_url', () => {
      const result = build('wan_v2_6_flash');
      expect(result).toHaveProperty('image_url', baseOptions.imageUrl);
    });
  });

  describe('Seedance v1 Pro', () => {
    it('formats duration as string', () => {
      const result = build('seedance_v1_pro');
      expect(result.duration).toBe('5');
      expect(typeof result.duration).toBe('string');
    });

    it('overrides resolution to 1080p', () => {
      const result = build('seedance_v1_pro');
      expect(result.resolution).toBe('1080p');
    });

    it('applies enable_safety_checker default', () => {
      const result = build('seedance_v1_pro');
      expect(result.enable_safety_checker).toBe(true);
    });
  });

  describe('common behavior', () => {
    it('always includes prompt', () => {
      for (const key of Object.keys(IMAGE_TO_VIDEO_MODELS)) {
        const result = build(safeImageToVideoModel(key));
        expect(result.prompt).toBe(baseOptions.prompt);
      }
    });

    it('passes aspect_ratio from options', () => {
      const result = build('seedance_v1_pro', { aspectRatio: '9:16' });
      expect(result.aspect_ratio).toBe('9:16');
    });

    it('omits aspect_ratio when not provided (API uses its own default)', () => {
      const result = build('seedance_v1_pro', { aspectRatio: undefined });
      expect(result.aspect_ratio).toBeUndefined();
    });
  });
});
