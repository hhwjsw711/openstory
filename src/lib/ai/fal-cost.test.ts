import { describe, expect, test } from 'bun:test';
import {
  calculateImageCost,
  calculateVideoCost,
  calculateAudioCost,
} from './fal-cost';
import {
  type Microdollars,
  ZERO_MICROS,
  usdToMicros,
} from '@/lib/billing/money';

/** Helper: convert expected USD to micros for comparison */
const usd = (n: number) => usdToMicros(n);

describe('calculateImageCost', () => {
  test('per_image model (nano-banana)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/nano-banana',
      numImages: 2,
    });
    // 39800 micros * 2 = 79600
    expect(cost).toBe(79_600 as Microdollars);
  });

  test('per_megapixel model (flux/schnell)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/flux/schnell',
      numImages: 1,
      widthPx: 1024,
      heightPx: 1024,
    });
    const megapixels = (1024 * 1024) / 1_000_000;
    // 3000 micros * megapixels ≈ 3146
    expect(cost).toBe(Math.round(3_000 * megapixels) as Microdollars);
  });

  test('per_compute_second model (sdxl)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/fast-sdxl',
      numImages: 1,
    });
    // 1250 micros * 3 (default compute seconds) = 3750
    expect(cost).toBe(3_750 as Microdollars);
  });

  test('nano-banana-2 base resolution', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/nano-banana-2',
      numImages: 1,
    });
    expect(cost).toBe(80_000 as Microdollars);
  });

  test('nano-banana-2 at 4K resolution (2x multiplier)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/nano-banana-2',
      numImages: 1,
      resolution: '4K',
    });
    expect(cost).toBe(160_000 as Microdollars);
  });

  test('nano-banana-2 at 0.5K resolution (0.75x multiplier)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/nano-banana-2',
      numImages: 1,
      resolution: '0.5K',
    });
    expect(cost).toBe(60_000 as Microdollars);
  });

  test('nano-banana-pro at 4K (2x multiplier)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/nano-banana-pro',
      numImages: 1,
      resolution: '4K',
    });
    expect(cost).toBe(300_000 as Microdollars);
  });

  test('recraft vector style (2x multiplier)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/recraft/v3/text-to-image',
      numImages: 1,
      style: 'vector_illustration',
    });
    expect(cost).toBe(80_000 as Microdollars);
  });

  test('recraft non-vector style (no multiplier)', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/recraft/v3/text-to-image',
      numImages: 1,
      style: 'realistic_image',
    });
    expect(cost).toBe(40_000 as Microdollars);
  });

  test('GPT Image 1.5 high quality 1024x1024', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/gpt-image-1.5',
      numImages: 1,
      quality: 'high',
      imageSize: '1024x1024',
    });
    expect(cost).toBe(144_000 as Microdollars);
  });

  test('GPT Image 1.5 medium quality 1024x1536', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/gpt-image-1.5',
      numImages: 1,
      quality: 'medium',
      imageSize: '1024x1536',
    });
    expect(cost).toBe(62_000 as Microdollars);
  });

  test('GPT Image 1.5 low quality 1536x1024', () => {
    const cost = calculateImageCost({
      endpointId: 'fal-ai/gpt-image-1.5',
      numImages: 2,
      quality: 'low',
      imageSize: '1536x1024',
    });
    expect(cost).toBe(50_000 as Microdollars);
  });

  test('unknown endpoint returns 0', () => {
    const cost = calculateImageCost({
      endpointId: 'unknown/model',
      numImages: 1,
    });
    expect(cost).toBe(ZERO_MICROS);
  });
});

describe('calculateVideoCost', () => {
  test('Veo3 audio on ($0.40/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3',
      durationSeconds: 8,
      audioEnabled: true,
    });
    // 400_000 * 8 = 3_200_000
    expect(cost).toBe(usd(3.2));
  });

  test('Veo3 audio off (base rate, no noAudioMultiplier)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3',
      durationSeconds: 8,
      audioEnabled: false,
    });
    // No noAudioMultiplier → uses basePrice. 400_000 * 8 = 3_200_000
    expect(cost).toBe(usd(3.2));
  });

  test('Veo3.1 at 1080p with audio ($0.40/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3.1/image-to-video',
      durationSeconds: 8,
      audioEnabled: true,
      resolution: '1080p',
    });
    expect(cost).toBe(usd(3.2));
  });

  test('Veo3.1 at 4K with audio ($0.60/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3.1/image-to-video',
      durationSeconds: 8,
      audioEnabled: true,
      resolution: '4K',
    });
    expect(cost).toBe(usd(4.8));
  });

  test('Veo3.1 at 4K no audio ($0.40/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3.1/image-to-video',
      durationSeconds: 8,
      audioEnabled: false,
      resolution: '4K',
    });
    expect(cost).toBe(usd(3.2));
  });

  test('Veo3.1 at 1080p no audio ($0.20/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/veo3.1/image-to-video',
      durationSeconds: 8,
      audioEnabled: false,
      resolution: '1080p',
    });
    expect(cost).toBe(usd(1.6));
  });

  test('Kling v3 Pro audio off (0.8x multiplier)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/kling-video/v3/pro/image-to-video',
      durationSeconds: 5,
      audioEnabled: false,
    });
    // 140_000 * 0.8 = 112_000 per second, * 5 = 560_000
    expect(cost).toBe(560_000 as Microdollars);
  });

  test('Kling v3 Pro audio on (1.2x multiplier)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/kling-video/v3/pro/image-to-video',
      durationSeconds: 5,
      audioEnabled: true,
    });
    // 140_000 * 1.2 = 168_000 per second, * 5 = 840_000
    expect(cost).toBe(840_000 as Microdollars);
  });

  test('Kling v3 Pro voice control (1.4x multiplier)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/kling-video/v3/pro/image-to-video',
      durationSeconds: 5,
      audioEnabled: true,
      voiceControl: true,
    });
    // 140_000 * 1.4 = 196_000 per second, * 5 = 980_000
    expect(cost).toBe(980_000 as Microdollars);
  });

  test('Wan Flash 720p ($0.05/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'wan/v2.6/image-to-video/flash',
      durationSeconds: 5,
      resolution: '720p',
    });
    expect(cost).toBe(usd(0.25));
  });

  test('Wan Flash 1080p ($0.075/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'wan/v2.6/image-to-video/flash',
      durationSeconds: 5,
      resolution: '1080p',
    });
    expect(cost).toBe(usd(0.375));
  });

  test('Grok Video 480p ($0.05/s + $0.002)', () => {
    const cost = calculateVideoCost({
      endpointId: 'xai/grok-imagine-video/image-to-video',
      durationSeconds: 6,
      resolution: '480p',
    });
    // 50_000 * 6 + 2_000 = 302_000
    expect(cost).toBe(302_000 as Microdollars);
  });

  test('Grok Video 720p ($0.07/s + $0.002)', () => {
    const cost = calculateVideoCost({
      endpointId: 'xai/grok-imagine-video/image-to-video',
      durationSeconds: 6,
      resolution: '720p',
    });
    // 70_000 * 6 + 2_000 = 422_000
    expect(cost).toBe(422_000 as Microdollars);
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
    // cost_micros = 2_500_000 * (243000 / 1_000_000) * 1.05
    const tokens = (1920 * 1080 * 24 * 5) / 1024;
    const expectedMicros = Math.round(2_500_000 * (tokens / 1_000_000) * 1.05);
    expect(cost).toBe(expectedMicros as Microdollars);
  });

  test('Seedance defaults to 1080p 24fps when no dimensions given', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
      durationSeconds: 5,
    });
    const tokens = (1920 * 1080 * 24 * 5) / 1024;
    const expectedMicros = Math.round(2_500_000 * (tokens / 1_000_000) * 1.05);
    expect(cost).toBe(expectedMicros as Microdollars);
  });

  test('Kling v2.5 Turbo Pro ($0.07/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
      durationSeconds: 5,
    });
    expect(cost).toBe(usd(0.35));
  });

  test('Sora 2 ($0.1/s)', () => {
    const cost = calculateVideoCost({
      endpointId: 'fal-ai/sora-2/image-to-video',
      durationSeconds: 4,
    });
    expect(cost).toBe(usd(0.4));
  });

  test('unknown endpoint returns 0', () => {
    const cost = calculateVideoCost({
      endpointId: 'unknown/model',
      durationSeconds: 5,
    });
    expect(cost).toBe(ZERO_MICROS);
  });
});

describe('calculateAudioCost', () => {
  test('ElevenLabs Music 30s (rounds to 1 min)', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/elevenlabs/music',
      durationSeconds: 30,
    });
    expect(cost).toBe(usd(0.8));
  });

  test('ElevenLabs Music 60s (exactly 1 min)', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/elevenlabs/music',
      durationSeconds: 60,
    });
    expect(cost).toBe(usd(0.8));
  });

  test('ElevenLabs Music 61s (rounds to 2 min)', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/elevenlabs/music',
      durationSeconds: 61,
    });
    expect(cost).toBe(usd(1.6));
  });

  test('ACE-Step per_second pricing', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/ace-step/prompt-to-audio',
      durationSeconds: 60,
    });
    // 200 micros * 60 = 12_000
    expect(cost).toBe(12_000 as Microdollars);
  });

  test('ElevenLabs SFX per_second pricing', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/elevenlabs/sound-effects',
      durationSeconds: 5,
    });
    // 2_000 * 5 = 10_000
    expect(cost).toBe(10_000 as Microdollars);
  });

  test('MMAudio per_second pricing', () => {
    const cost = calculateAudioCost({
      endpointId: 'fal-ai/mmaudio-v2',
      durationSeconds: 8,
    });
    // 1_000 * 8 = 8_000
    expect(cost).toBe(8_000 as Microdollars);
  });

  test('Beatoven per_compute_second pricing', () => {
    const cost = calculateAudioCost({
      endpointId: 'beatoven/music-generation',
      durationSeconds: 90,
    });
    // 1_250 * 3 (default) = 3_750
    expect(cost).toBe(3_750 as Microdollars);
  });

  test('unknown endpoint returns 0', () => {
    const cost = calculateAudioCost({
      endpointId: 'unknown/model',
      durationSeconds: 60,
    });
    expect(cost).toBe(ZERO_MICROS);
  });
});
