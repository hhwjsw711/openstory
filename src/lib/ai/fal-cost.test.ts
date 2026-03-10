import { describe, expect, test } from 'bun:test';
import {
  calculateImageCost,
  calculateVideoCost,
  calculateAudioCost,
} from './fal-cost';

describe('calculateImageCost', () => {
  test('per_image model (nano-banana)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/nano-banana',
      numImages: 2,
    });
    expect(cost).toBeCloseTo(0.0398 * 2, 5);
  });

  test('per_megapixel model (flux/schnell)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/flux/schnell',
      numImages: 1,
      widthPx: 1024,
      heightPx: 1024,
    });
    const megapixels = (1024 * 1024) / 1_000_000;
    expect(cost).toBeCloseTo(0.003 * megapixels, 5);
  });

  test('per_compute_second model (sdxl)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/fast-sdxl',
      numImages: 1,
    });
    // 0.00125 * 3 (default compute seconds)
    expect(cost).toBeCloseTo(0.00375, 5);
  });

  test('nano-banana-2 base resolution', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/nano-banana-2',
      numImages: 1,
    });
    expect(cost).toBeCloseTo(0.08, 5);
  });

  test('nano-banana-2 at 4K resolution (2x multiplier)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/nano-banana-2',
      numImages: 1,
      resolution: '4K',
    });
    expect(cost).toBeCloseTo(0.08 * 2, 5);
  });

  test('nano-banana-2 at 0.5K resolution (0.75x multiplier)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/nano-banana-2',
      numImages: 1,
      resolution: '0.5K',
    });
    expect(cost).toBeCloseTo(0.08 * 0.75, 5);
  });

  test('nano-banana-pro at 4K (2x multiplier)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/nano-banana-pro',
      numImages: 1,
      resolution: '4K',
    });
    expect(cost).toBeCloseTo(0.15 * 2, 5);
  });

  test('recraft vector style (2x multiplier)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/recraft/v3/text-to-image',
      numImages: 1,
      style: 'vector_illustration',
    });
    expect(cost).toBeCloseTo(0.04 * 2, 5);
  });

  test('recraft non-vector style (no multiplier)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/recraft/v3/text-to-image',
      numImages: 1,
      style: 'realistic_image',
    });
    expect(cost).toBeCloseTo(0.04, 5);
  });

  test('GPT Image 1.5 high quality 1024x1024', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/gpt-image-1.5',
      numImages: 1,
      quality: 'high',
      imageSize: '1024x1024',
    });
    expect(cost).toBeCloseTo(0.133, 5);
  });

  test('GPT Image 1.5 medium quality 1024x1536', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/gpt-image-1.5',
      numImages: 1,
      quality: 'medium',
      imageSize: '1024x1536',
    });
    expect(cost).toBeCloseTo(0.051, 5);
  });

  test('GPT Image 1.5 low quality 1536x1024', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/gpt-image-1.5',
      numImages: 2,
      quality: 'low',
      imageSize: '1536x1024',
    });
    expect(cost).toBeCloseTo(0.013 * 2, 5);
  });

  test('unknown endpoint returns 0', () => {
    const cost = calculateImageCost({
      endpointId: 'unknown/model',
      numImages: 1,
    });
    expect(cost).toBe(0);
  });
});

describe('calculateVideoCost', () => {
  test('Veo3 audio on ($0.40/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3',
      durationSeconds: 8,
      audioEnabled: true,
    });
    // 0.2 * 2.0 * 8 = 3.20
    expect(cost).toBeCloseTo(3.2, 5);
  });

  test('Veo3 audio off ($0.20/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3',
      durationSeconds: 8,
      audioEnabled: false,
    });
    expect(cost).toBeCloseTo(1.6, 5);
  });

  test('Veo3.1 at 1080p with audio ($0.40/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3.1/image-to-video',
      durationSeconds: 8,
      audioEnabled: true,
      resolution: '1080p',
    });
    expect(cost).toBeCloseTo(3.2, 5);
  });

  test('Veo3.1 at 4K with audio ($0.60/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3.1/image-to-video',
      durationSeconds: 8,
      audioEnabled: true,
      resolution: '4K',
    });
    expect(cost).toBeCloseTo(4.8, 5);
  });

  test('Veo3.1 at 4K no audio ($0.40/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3.1/image-to-video',
      durationSeconds: 8,
      audioEnabled: false,
      resolution: '4K',
    });
    expect(cost).toBeCloseTo(3.2, 5);
  });

  test('Veo3.1 at 1080p no audio ($0.20/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3.1/image-to-video',
      durationSeconds: 8,
      audioEnabled: false,
      resolution: '1080p',
    });
    expect(cost).toBeCloseTo(1.6, 5);
  });

  test('Kling v3 Pro audio off ($0.224/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/kling-video/v3/pro/image-to-video',
      durationSeconds: 5,
      audioEnabled: false,
    });
    expect(cost).toBeCloseTo(0.224 * 5, 5);
  });

  test('Kling v3 Pro audio on ($0.336/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/kling-video/v3/pro/image-to-video',
      durationSeconds: 5,
      audioEnabled: true,
    });
    // 0.224 * 1.5 * 5 = 1.68
    expect(cost).toBeCloseTo(1.68, 5);
  });

  test('Kling v3 Pro voice control ($0.392/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/kling-video/v3/pro/image-to-video',
      durationSeconds: 5,
      audioEnabled: true,
      voiceControl: true,
    });
    // 0.224 * 1.75 * 5 = 1.96
    expect(cost).toBeCloseTo(1.96, 5);
  });

  test('Wan Flash 720p ($0.05/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'wan/v2.6/image-to-video/flash',
      durationSeconds: 5,
      resolution: '720p',
    });
    expect(cost).toBeCloseTo(0.25, 5);
  });

  test('Wan Flash 1080p ($0.075/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'wan/v2.6/image-to-video/flash',
      durationSeconds: 5,
      resolution: '1080p',
    });
    expect(cost).toBeCloseTo(0.375, 5);
  });

  test('Grok Video 480p ($0.05/s + $0.002)', () => {
    const cost = calculateVideoCost({
      endpointId: 'xai/grok-imagine-video/image-to-video',
      durationSeconds: 6,
      resolution: '480p',
    });
    // 0.05 * 6 + 0.002 = 0.302
    expect(cost).toBeCloseTo(0.302, 5);
  });

  test('Grok Video 720p ($0.07/s + $0.002)', () => {
    const cost = calculateVideoCost({
      endpointId: 'xai/grok-imagine-video/image-to-video',
      durationSeconds: 6,
      resolution: '720p',
    });
    // 0.07 * 6 + 0.002 = 0.422
    expect(cost).toBeCloseTo(0.422, 5);
  });

  test('Seedance 1080p 5s 24fps (per_token)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
      durationSeconds: 5,
      widthPx: 1920,
      heightPx: 1080,
      fps: 24,
    });
    // tokens = (1920 * 1080 * 24 * 5) / 1024 = 243000
    // cost = 2.5 * (243000 / 1_000_000) = 0.6075
    const tokens = (1920 * 1080 * 24 * 5) / 1024;
    expect(cost).toBeCloseTo(2.5 * (tokens / 1_000_000), 5);
  });

  test('Seedance defaults to 1080p 24fps when no dimensions given', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
      durationSeconds: 5,
    });
    const tokens = (1920 * 1080 * 24 * 5) / 1024;
    expect(cost).toBeCloseTo(2.5 * (tokens / 1_000_000), 5);
  });

  test('Kling v2.5 Turbo Pro ($0.07/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
      durationSeconds: 5,
    });
    expect(cost).toBeCloseTo(0.35, 5);
  });

  test('Sora 2 ($0.1/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/sora-2/image-to-video',
      durationSeconds: 4,
    });
    expect(cost).toBeCloseTo(0.4, 5);
  });

  test('unknown endpoint returns 0', () => {
    const cost = calculateVideoCost({
      endpointId: 'unknown/model',
      durationSeconds: 5,
    });
    expect(cost).toBe(0);
  });
});

describe('calculateAudioCost', () => {
  test('ElevenLabs Music 30s (rounds to 1 min = $0.80)', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/elevenlabs/music',
      durationSeconds: 30,
    });
    expect(cost).toBeCloseTo(0.8, 5);
  });

  test('ElevenLabs Music 60s (exactly 1 min = $0.80)', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/elevenlabs/music',
      durationSeconds: 60,
    });
    expect(cost).toBeCloseTo(0.8, 5);
  });

  test('ElevenLabs Music 61s (rounds to 2 min = $1.60)', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/elevenlabs/music',
      durationSeconds: 61,
    });
    expect(cost).toBeCloseTo(1.6, 5);
  });

  test('ACE-Step per_second pricing', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/ace-step/prompt-to-audio',
      durationSeconds: 60,
    });
    expect(cost).toBeCloseTo(0.0002 * 60, 5);
  });

  test('ElevenLabs SFX per_second pricing', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/elevenlabs/sound-effects',
      durationSeconds: 5,
    });
    expect(cost).toBeCloseTo(0.002 * 5, 5);
  });

  test('MMAudio per_second pricing', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/mmaudio-v2',
      durationSeconds: 8,
    });
    expect(cost).toBeCloseTo(0.001 * 8, 5);
  });

  test('Beatoven per_compute_second pricing', () => {
    const cost = calculateAudioCost({
      endpointId: 'beatoven/music-generation',
      durationSeconds: 90,
    });
    // per_compute_second: 0.00125 * 3 (default) = 0.00375
    expect(cost).toBeCloseTo(0.00125 * 3, 5);
  });

  test('unknown endpoint returns 0', () => {
    const cost = calculateAudioCost({
      endpointId: 'unknown/model',
      durationSeconds: 60,
    });
    expect(cost).toBe(0);
  });
});
