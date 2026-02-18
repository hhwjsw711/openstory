import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
  isValidImageToVideoModel,
  isValidTextToImageModel,
  safeImageToVideoModel,
  safeTextToImageModel,
} from './models';

describe('Model Validation', () => {
  describe('isValidTextToImageModel', () => {
    it('returns true for valid model keys', () => {
      expect(isValidTextToImageModel('flux_pro')).toBe(true);
      expect(isValidTextToImageModel('nano_banana_pro')).toBe(true);
      expect(isValidTextToImageModel('flux_schnell')).toBe(true);
    });

    it('returns false for invalid model keys', () => {
      expect(isValidTextToImageModel('invalid_model')).toBe(false);
      expect(isValidTextToImageModel('flux_pro_invalid')).toBe(false);
      expect(isValidTextToImageModel('')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isValidTextToImageModel(null)).toBe(false);
      expect(isValidTextToImageModel(undefined)).toBe(false);
    });
  });

  describe('isValidImageToVideoModel', () => {
    it('returns true for valid model keys', () => {
      expect(isValidImageToVideoModel('kling_v2_5_turbo_pro')).toBe(true);
      expect(isValidImageToVideoModel('kling_v3_pro')).toBe(true);
      expect(isValidImageToVideoModel('veo3_1')).toBe(true);
    });

    it('returns false for invalid model keys', () => {
      expect(isValidImageToVideoModel('invalid_model')).toBe(false);
      expect(isValidImageToVideoModel('wan_invalid')).toBe(false);
      expect(isValidImageToVideoModel('')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isValidImageToVideoModel(null)).toBe(false);
      expect(isValidImageToVideoModel(undefined)).toBe(false);
    });
  });

  describe('safeTextToImageModel', () => {
    it('returns the model key when valid', () => {
      expect(safeTextToImageModel('flux_pro')).toBe('flux_pro');
      expect(safeTextToImageModel('nano_banana_pro')).toBe('nano_banana_pro');
    });

    it('returns default when invalid', () => {
      expect(safeTextToImageModel('invalid_model')).toBe(DEFAULT_IMAGE_MODEL);
      expect(safeTextToImageModel('')).toBe(DEFAULT_IMAGE_MODEL);
      expect(safeTextToImageModel(null)).toBe(DEFAULT_IMAGE_MODEL);
      expect(safeTextToImageModel(undefined)).toBe(DEFAULT_IMAGE_MODEL);
    });

    it('uses custom fallback when provided', () => {
      const customFallback = 'flux_schnell';
      expect(safeTextToImageModel('invalid_model', customFallback)).toBe(
        customFallback
      );
    });

    it('validates all IMAGE_MODELS keys', () => {
      for (const key of Object.keys(IMAGE_MODELS)) {
        expect(safeTextToImageModel(key) as string).toBe(key);
      }
    });
  });

  describe('safeImageToVideoModel', () => {
    it('returns the model key when valid', () => {
      expect(safeImageToVideoModel('kling_v2_5_turbo_pro')).toBe(
        'kling_v2_5_turbo_pro'
      );
      expect(safeImageToVideoModel('kling_v3_pro')).toBe('kling_v3_pro');
    });

    it('returns default when invalid', () => {
      expect(safeImageToVideoModel('invalid_model')).toBe(DEFAULT_VIDEO_MODEL);
      expect(safeImageToVideoModel('')).toBe(DEFAULT_VIDEO_MODEL);
      expect(safeImageToVideoModel(null)).toBe(DEFAULT_VIDEO_MODEL);
      expect(safeImageToVideoModel(undefined)).toBe(DEFAULT_VIDEO_MODEL);
    });

    it('uses custom fallback when provided', () => {
      const customFallback = 'kling_v2_5_turbo_pro';
      expect(safeImageToVideoModel('invalid_model', customFallback)).toBe(
        customFallback
      );
    });

    it('validates all IMAGE_TO_VIDEO_MODELS keys', () => {
      for (const key of Object.keys(IMAGE_TO_VIDEO_MODELS)) {
        expect(safeImageToVideoModel(key) as string).toBe(key);
      }
    });
  });

  describe('Type Guards', () => {
    it('isValidTextToImageModel acts as a type guard', () => {
      const maybeModel: string = 'flux_pro';
      if (isValidTextToImageModel(maybeModel)) {
        // TypeScript should infer maybeModel as TextToImageModel here
        const model = maybeModel;
        expect(IMAGE_MODELS[model]).toBeDefined();
      }
    });

    it('isValidImageToVideoModel acts as a type guard', () => {
      const maybeModel: string = 'kling_v3_pro';
      if (isValidImageToVideoModel(maybeModel)) {
        // TypeScript should infer maybeModel as ImageToVideoModel here
        const model = maybeModel;
        expect(IMAGE_TO_VIDEO_MODELS[model]).toBeDefined();
      }
    });
  });
});
