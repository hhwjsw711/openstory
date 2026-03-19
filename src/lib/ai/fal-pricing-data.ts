// AUTO-GENERATED — do not edit manually. Run: bun scripts/update-fal-pricing.ts
// Manual overrides (multipliers, matrices) are maintained in scripts/update-fal-pricing.ts

import { type Microdollars, micros } from '@/lib/billing/money';

// ============================================================================
// Image Pricing (all prices in microdollars: 1 USD = 1,000,000)
// ============================================================================

type ImagePricingUnit = 'per_image' | 'per_megapixel' | 'per_compute_second';

export type ImagePricing = {
  basePrice: Microdollars;
  unit: ImagePricingUnit;
  resolutionMultipliers?: Partial<Record<'0.5K' | '1K' | '2K' | '4K', number>>;
  styleMultipliers?: Record<string, number>;
  qualitySizeMatrix?: Record<string, Record<string, Microdollars>>;
  surcharges?: { webSearch?: Microdollars };
  pricingNotes?: string;
};

export const IMAGE_PRICING: Record<string, ImagePricing> = {
  'fal-ai/bytedance/seedream/v4.5/text-to-image': {
    basePrice: micros(40_000),
    unit: 'per_image',
    pricingNotes:
      '- **Price**: $0.04 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/fast-lightning-sdxl': {
    basePrice: micros(1_250),
    unit: 'per_compute_second',
    pricingNotes:
      '- **Price**: $0 per compute seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/fast-sdxl': {
    basePrice: micros(1_250),
    unit: 'per_compute_second',
    pricingNotes:
      '- **Price**: $0 per compute seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-2': {
    basePrice: micros(12_000),
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.012 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-2/klein/4b': {
    basePrice: micros(9_000),
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.005 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-krea-lora': {
    basePrice: micros(35_000),
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.035 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-pro': {
    basePrice: micros(50_000),
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.05 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-pro/v1.1-ultra': {
    basePrice: micros(60_000),
    unit: 'per_image',
    pricingNotes:
      '- **Price**: $0.06 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux/dev': {
    basePrice: micros(25_000),
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.025 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux/schnell': {
    basePrice: micros(3_000),
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.003 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/gpt-image-1.5': {
    basePrice: micros(0),
    unit: 'per_image',
    qualitySizeMatrix: {
      low: {
        '1024x1024': micros(20_000),
        '1024x1536': micros(25_000),
        '1536x1024': micros(25_000),
      },
      medium: {
        '1024x1024': micros(45_000),
        '1024x1536': micros(62_000),
        '1536x1024': micros(61_000),
      },
      high: {
        '1024x1024': micros(144_000),
        '1024x1536': micros(211_000),
        '1536x1024': micros(210_000),
      },
    },
    pricingNotes:
      "Your request will cost different amounts based on the number of images, quality, and size.\n\n- You will be charged $0.005 per 1,000 input text tokens. One word is roughly 4 tokens.\n-  You will be charged $0.010 per 1,000 output text tokens. The model will consume tokens reasoning about your prompt based on it's complexity.\n- For **low** quality, you will be charged $0.009 for 1024x1024 or $0.013 for any other size *per image*. \n- For **medium** quality, you will be charged $0.034 for 1024x1024, $0.051 for 1024x1536 and $0.050 for 1536x1024 *per image*.\n- For **high** quality, you will be charged $0.133 for 1024x1024, $0.200 for 1024x1536 or $0.199 for 1536x1024 *per image*.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).",
  },
  'fal-ai/hidream-i1-full': {
    basePrice: micros(50_000),
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.05 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/imagen4/preview/ultra': {
    basePrice: micros(60_000),
    unit: 'per_image',
    pricingNotes:
      '- **Price**: $0.06 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-image/v3/text-to-image': {
    basePrice: micros(28_000),
    unit: 'per_image',
    pricingNotes:
      '- **Price**: $0.028 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana': {
    basePrice: micros(39_800),
    unit: 'per_image',
    pricingNotes:
      'Your request will cost **$0.039** per image. For **$1.00**, you can run this model **25 times.**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana-2': {
    basePrice: micros(80_000),
    unit: 'per_image',
    resolutionMultipliers: {
      '0.5K': 0.75,
      '1K': 1,
      '2K': 1.5,
      '4K': 2,
    },
    surcharges: {
      webSearch: micros(15_000),
    },
    pricingNotes:
      'Your request will cost **$0.08** per image. For **$1.00**, you can run this model **12** times. 2K and 4K outputs will be charged at **1.5** times and **2** times the standard rate, respectively. 0.5K (512px) resolution outputs will be charged at **0.75** times the standard rate. If web search is used, an additional $0.015 will be charged. **Note: Pricing is subject to change.**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana-2/edit': {
    basePrice: micros(80_000),
    unit: 'per_image',
    resolutionMultipliers: {
      '0.5K': 0.75,
      '1K': 1,
      '2K': 1.5,
      '4K': 2,
    },
    surcharges: {
      webSearch: micros(15_000),
    },
    pricingNotes:
      'Your request will cost **$0.08** per image. For **$1.00**, you can run this model **12** times. 2K and 4K outputs will be charged at **1.5** times and **2** times the standard rate, respectively. 0.5K (512px) resolution outputs will be charged at **0.75** times the standard rate. If web search is used, an additional $0.015 will be charged. **Note: Pricing is subject to change.**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana-pro': {
    basePrice: micros(150_000),
    unit: 'per_image',
    resolutionMultipliers: {
      '4K': 2,
    },
    surcharges: {
      webSearch: micros(15_000),
    },
    pricingNotes:
      'Your request will cost **$0.15** per image. For **$1.00**, you can run this model **7** times. 4K outputs will be charged at double the standard rate. If web search is used, an additional $0.015 will be charged. Note: Pricing may change in the future.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana-pro/edit': {
    basePrice: micros(150_000),
    unit: 'per_image',
    resolutionMultipliers: {
      '4K': 2,
    },
    surcharges: {
      webSearch: micros(15_000),
    },
    pricingNotes:
      'Your request will cost **$0.15** per image. For **$1.00**, you can run this model **7** times. 4K outputs will be charged at double the standard rate. If web search is used, an additional $0.015 will be charged. Note: Pricing may change in the future.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/recraft/v3/text-to-image': {
    basePrice: micros(40_000),
    unit: 'per_image',
    styleMultipliers: {
      vector_illustration: 2,
      vector: 2,
    },
    pricingNotes:
      'Your request will cost **$0.04** per image (or **$0.08** if you are using a vector style). For $1 you can run this model approximately **25** times.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'xai/grok-imagine-image': {
    basePrice: micros(20_000),
    unit: 'per_image',
    pricingNotes:
      '- **Price**: $0.02 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
};

// ============================================================================
// Video Pricing (all prices in microdollars: 1 USD = 1,000,000)
// ============================================================================

type VideoPricingBase = { pricingNotes?: string };

type VideoPricingPerSecond = VideoPricingBase & {
  mode: 'per_second';
  basePrice: Microdollars;
  noAudioMultiplier?: number;
  audioMultiplier?: number;
  voiceControlMultiplier?: number;
  resolutionPricing?: Record<string, Microdollars>;
  resolutionAudioPricing?: Record<
    string,
    { noAudio: Microdollars; withAudio: Microdollars }
  >;
  surcharges?: { imageInput?: Microdollars };
};

type VideoPricingPerToken = VideoPricingBase & {
  mode: 'per_token';
  pricePerMillionTokens: Microdollars;
};

export type VideoPricing = VideoPricingPerSecond | VideoPricingPerToken;

export const VIDEO_PRICING: Record<string, VideoPricing> = {
  'fal-ai/bytedance/seedance/v1/pro/image-to-video': {
    mode: 'per_token',
    pricePerMillionTokens: micros(2_500_000),
    pricingNotes:
      'Each 1080p 5 second video costs roughly **$0.62**. For other resolutions, 1 million video tokens costs **$2.5**. tokens(video)  = (height x width x FPS x duration) / 1024. \n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-video/o1/image-to-video': {
    mode: 'per_second',
    basePrice: micros(112_000),
    pricingNotes:
      '- **Price**: $0.112 per seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video': {
    mode: 'per_second',
    basePrice: micros(70_000),
    pricingNotes:
      'For **5s** video your request will cost **$0.35**. For every additional second you will be charged **$0.07.**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-video/v3/pro/image-to-video': {
    mode: 'per_second',
    basePrice: micros(140_000),
    noAudioMultiplier: 0.8,
    audioMultiplier: 1.2,
    voiceControlMultiplier: 1.4,
    pricingNotes:
      'For every second of video you generated, you will be charged **$0.112** (audio off) or **$0.168** (audio on), if voice control is used while generating audio you will be charged **$0.196**. For example, a 5s video with audio on and voice control will cost **$0.98**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/sora-2/image-to-video': {
    mode: 'per_second',
    basePrice: micros(100_000),
    pricingNotes:
      'The pricing is $0.1/s for Sora 2.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/veo3': {
    mode: 'per_second',
    basePrice: micros(400_000),
    pricingNotes:
      'For every second of video you generated, you will be charged **$0.20** (audio off) or **$0.40** (audio on). For example, a **5s video** with audio on will cost **$2**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/veo3.1/image-to-video': {
    mode: 'per_second',
    basePrice: micros(400_000),
    resolutionAudioPricing: {
      '720p': {
        noAudio: micros(200_000),
        withAudio: micros(400_000),
      },
      '1080p': {
        noAudio: micros(200_000),
        withAudio: micros(400_000),
      },
      '4K': {
        noAudio: micros(400_000),
        withAudio: micros(600_000),
      },
    },
    pricingNotes:
      'For every second of video you generate you will be charged **$0.20** without audio or **$0.40** with audio for 720p or 1080p. At 4k, you will be charged **$0.40** per second without audio, or **$0.60** with. For example, a **5 second video** at **1080p** with **audio on** will cost **$2.00**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'wan/v2.6/image-to-video/flash': {
    mode: 'per_second',
    basePrice: micros(50_000),
    resolutionPricing: {
      '720p': micros(50_000),
      '1080p': micros(75_000),
    },
    pricingNotes:
      'Your request will cost  **$0.05** per second for **720p**, **$0.075** per second for **1080p**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'xai/grok-imagine-video/image-to-video': {
    mode: 'per_second',
    basePrice: micros(50_000),
    resolutionPricing: {
      '480p': micros(50_000),
      '720p': micros(70_000),
    },
    surcharges: {
      imageInput: micros(2_000),
    },
    pricingNotes:
      'A 6s 480p video will cost **$0.302** (**$0.05** per second of 480p video + **$0.002** for image input). At an output resolution of 480p, every second costs **$0.05**, and at 720p, every second costs **$0.07**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
};

// ============================================================================
// Audio Pricing (all prices in microdollars: 1 USD = 1,000,000)
// ============================================================================

type AudioPricingUnit = 'per_second' | 'per_minute' | 'per_compute_second';

export type AudioPricing = {
  basePrice: Microdollars;
  unit: AudioPricingUnit;
  roundUpToMinute?: boolean;
  pricingNotes?: string;
};

export const AUDIO_PRICING: Record<string, AudioPricing> = {
  'beatoven/music-generation': {
    basePrice: micros(1_250),
    unit: 'per_compute_second',
    pricingNotes:
      '- **Price**: $0.1 per requests\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/ace-step/audio-to-audio': {
    basePrice: micros(200),
    unit: 'per_second',
    pricingNotes:
      'Your request will cost $0.0002 per second of generated audio. For $1 you can run generate 5000 seconds (83 minutes) of music from lyrics.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/ace-step/prompt-to-audio': {
    basePrice: micros(200),
    unit: 'per_second',
    pricingNotes:
      'Your request will cost $0.0002 per second of generated audio. For $1 you can run generate 5000 seconds (83 minutes) of music from lyrics.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/elevenlabs/music': {
    basePrice: micros(800_000),
    unit: 'per_minute',
    roundUpToMinute: true,
    pricingNotes:
      'Your request will cost **$0.8** per output audio minute. The audio will be **rounded up** to the closest minute. For instance, a generation with 30 seconds output will be billed as 1 minute.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/elevenlabs/sound-effects': {
    basePrice: micros(2_000),
    unit: 'per_second',
    pricingNotes:
      '- **Price**: $0.002 per seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/mmaudio-v2': {
    basePrice: micros(1_000),
    unit: 'per_second',
    pricingNotes:
      '- **Price**: $0.001 per seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
};

export const PRICING_LAST_UPDATED = '2026-03-19T05:54:07.400Z';
