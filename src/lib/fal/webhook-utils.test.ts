/**
 * Tests for fal webhook utilities
 */

import { describe, expect, it, mock } from 'bun:test';
import {
  buildFalQueueUrl,
  parseFalWebhookResponse,
  parseFalVideoWebhookResponse,
  parseFalImageWebhookResponse,
  type FalVideoResult,
  type FalImageResult,
} from './webhook-utils';

// Mock the env module
mock.module('#env', () => ({
  getEnv: () => ({
    FAL_KEY: 'test-fal-key-123',
  }),
}));

// Import after mocking
const { getFalAuthHeaders } = await import('./webhook-utils');

describe('fal webhook utilities', () => {
  describe('buildFalQueueUrl', () => {
    it('should build correct URL with encoded webhook parameter', () => {
      const modelId = 'fal-ai/kling-video/v2.6/pro/image-to-video';
      const webhookUrl = 'https://qstash.upstash.io/v2/publish/abc123';

      const result = buildFalQueueUrl(modelId, webhookUrl);

      expect(result).toBe(
        `https://queue.fal.run/${modelId}?fal_webhook=${encodeURIComponent(webhookUrl)}`
      );
    });

    it('should handle special characters in webhook URL', () => {
      const modelId = 'fal-ai/flux/dev';
      const webhookUrl = 'https://example.com/webhook?token=abc&foo=bar#anchor';

      const result = buildFalQueueUrl(modelId, webhookUrl);

      expect(result).toContain('queue.fal.run');
      expect(result).toContain(encodeURIComponent(webhookUrl));
    });
  });

  describe('getFalAuthHeaders', () => {
    it('should return correct headers with API key', () => {
      const headers = getFalAuthHeaders();

      expect(headers).toEqual({
        Authorization: 'Key test-fal-key-123',
        'Content-Type': 'application/json',
      });
    });
  });

  describe('parseFalWebhookResponse', () => {
    it('should throw on timeout', () => {
      const webhookResult = { timeout: true };

      expect(() => parseFalWebhookResponse(webhookResult)).toThrow(
        'Fal generation timed out waiting for webhook callback'
      );
    });

    it('should throw on missing body', () => {
      const webhookResult = { timeout: false };

      expect(() => parseFalWebhookResponse(webhookResult)).toThrow(
        'No webhook payload received from fal'
      );
    });

    it('should throw on invalid payload format', () => {
      const webhookResult = {
        timeout: false,
        request: { body: { invalid: 'format' } },
      };

      expect(() => parseFalWebhookResponse(webhookResult)).toThrow(
        'Invalid fal webhook payload format'
      );
    });

    it('should throw on error status', () => {
      const webhookResult = {
        timeout: false,
        request: {
          body: {
            request_id: 'test-123',
            status: 'ERROR' as const,
            error: 'Something went wrong',
          },
        },
      };

      expect(() => parseFalWebhookResponse(webhookResult)).toThrow(
        'Something went wrong'
      );
    });

    it('should throw on missing payload', () => {
      const webhookResult = {
        timeout: false,
        request: {
          body: {
            request_id: 'test-123',
            status: 'OK' as const,
          },
        },
      };

      expect(() => parseFalWebhookResponse(webhookResult)).toThrow(
        'Fal webhook response missing payload'
      );
    });

    it('should return payload on success', () => {
      const expectedPayload = {
        video: { url: 'https://example.com/video.mp4' },
      };
      const webhookResult = {
        timeout: false,
        request: {
          body: {
            request_id: 'test-123',
            status: 'OK' as const,
            payload: expectedPayload,
          },
        },
      };

      const result = parseFalWebhookResponse<FalVideoResult>(webhookResult);

      expect(result).toEqual(expectedPayload);
    });
  });

  describe('parseFalVideoWebhookResponse', () => {
    it('should throw on missing video URL', () => {
      const webhookResult = {
        timeout: false,
        request: {
          body: {
            request_id: 'test-123',
            status: 'OK' as const,
            payload: { video: {} },
          },
        },
      };

      expect(() => parseFalVideoWebhookResponse(webhookResult)).toThrow(
        'No video URL in fal webhook response'
      );
    });

    it('should return video result on success', () => {
      const expectedPayload: FalVideoResult = {
        video: {
          url: 'https://example.com/video.mp4',
          file_name: 'output.mp4',
          file_size: 1024000,
        },
      };
      const webhookResult = {
        timeout: false,
        request: {
          body: {
            request_id: 'test-123',
            status: 'OK' as const,
            payload: expectedPayload,
          },
        },
      };

      const result = parseFalVideoWebhookResponse(webhookResult);

      expect(result.video.url).toBe('https://example.com/video.mp4');
      expect(result.video.file_name).toBe('output.mp4');
    });
  });

  describe('parseFalImageWebhookResponse', () => {
    it('should throw on missing images', () => {
      const webhookResult = {
        timeout: false,
        request: {
          body: {
            request_id: 'test-123',
            status: 'OK' as const,
            payload: { images: [] },
          },
        },
      };

      expect(() => parseFalImageWebhookResponse(webhookResult)).toThrow(
        'No image URLs in fal webhook response'
      );
    });

    it('should throw on missing image URL', () => {
      const webhookResult = {
        timeout: false,
        request: {
          body: {
            request_id: 'test-123',
            status: 'OK' as const,
            payload: { images: [{}] },
          },
        },
      };

      expect(() => parseFalImageWebhookResponse(webhookResult)).toThrow(
        'No image URLs in fal webhook response'
      );
    });

    it('should return image result on success', () => {
      const expectedPayload: FalImageResult = {
        images: [
          {
            url: 'https://example.com/image.png',
            width: 1024,
            height: 1024,
          },
        ],
        seed: 12345,
        timings: { inference: 2.5 },
      };
      const webhookResult = {
        timeout: false,
        request: {
          body: {
            request_id: 'test-123',
            status: 'OK' as const,
            payload: expectedPayload,
          },
        },
      };

      const result = parseFalImageWebhookResponse(webhookResult);

      expect(result.images[0].url).toBe('https://example.com/image.png');
      expect(result.images[0].width).toBe(1024);
      expect(result.seed).toBe(12345);
    });
  });
});
