// AUTO-GENERATED — do not edit manually. Run: bun scripts/update-fal-pricing.ts
// Manual overrides (multipliers, matrices) are maintained in scripts/update-fal-pricing.ts

// ============================================================================
// Image Pricing
// ============================================================================

type ImagePricingUnit = 'per_image' | 'per_megapixel' | 'per_compute_second';

export type ImagePricing = {
  basePrice: number;
  unit: ImagePricingUnit;
  resolutionMultipliers?: Partial<Record<'0.5K' | '1K' | '2K' | '4K', number>>;
  styleMultipliers?: Record<string, number>;
  qualitySizeMatrix?: Record<string, Record<string, number>>;
  surcharges?: { webSearch?: number };
  pricingNotes?: string;
};

export const IMAGE_PRICING: Record<string, ImagePricing> = {
  'fal-ai/bytedance/seedream/v4.5/text-to-image': {
    basePrice: 0.04,
    unit: 'per_image',
    pricingNotes:
      '- **Price**: $0.04 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/fast-lightning-sdxl': {
    basePrice: 0.00125,
    unit: 'per_compute_second',
    pricingNotes:
      '- **Price**: $0 per compute seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/fast-sdxl': {
    basePrice: 0.00125,
    unit: 'per_compute_second',
    pricingNotes:
      '- **Price**: $0 per compute seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-2': {
    basePrice: 0.012,
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.012 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-2/klein/4b': {
    basePrice: 0.009,
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.005 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-krea-lora': {
    basePrice: 0.035,
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.035 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-pro': {
    basePrice: 0.05,
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.05 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-pro/v1.1-ultra': {
    basePrice: 0.06,
    unit: 'per_image',
    pricingNotes:
      '- **Price**: $0.06 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux/dev': {
    basePrice: 0.025,
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.025 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux/schnell': {
    basePrice: 0.003,
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.003 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/gpt-image-1.5': {
    basePrice: 0,
    unit: 'per_image',
    qualitySizeMatrix: {
      low: {
        '1024x1024': 0.02,
        '1024x1536': 0.025,
        '1536x1024': 0.025,
      },
      medium: {
        '1024x1024': 0.045,
        '1024x1536': 0.062,
        '1536x1024': 0.061,
      },
      high: {
        '1024x1024': 0.144,
        '1024x1536': 0.211,
        '1536x1024': 0.21,
      },
    },
    pricingNotes:
      "Your request will cost different amounts based on the number of images, quality, and size.\n\n- You will be charged $0.005 per 1,000 input text tokens. One word is roughly 4 tokens.\n-  You will be charged $0.010 per 1,000 output text tokens. The model will consume tokens reasoning about your prompt based on it's complexity.\n- For **low** quality, you will be charged $0.009 for 1024x1024 or $0.013 for any other size *per image*. \n- For **medium** quality, you will be charged $0.034 for 1024x1024, $0.051 for 1024x1536 and $0.050 for 1536x1024 *per image*.\n- For **high** quality, you will be charged $0.133 for 1024x1024, $0.200 for 1024x1536 or $0.199 for 1536x1024 *per image*.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).",
  },
  'fal-ai/hidream-i1-full': {
    basePrice: 0.05,
    unit: 'per_megapixel',
    pricingNotes:
      '- **Price**: $0.05 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/imagen4/preview/ultra': {
    basePrice: 0.06,
    unit: 'per_image',
    pricingNotes:
      '- **Price**: $0.06 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-image/v3/text-to-image': {
    basePrice: 0.028,
    unit: 'per_image',
    pricingNotes:
      '- **Price**: $0.028 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana': {
    basePrice: 0.0398,
    unit: 'per_image',
    pricingNotes:
      'Your request will cost **$0.039** per image. For **$1.00**, you can run this model **25 times.**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana-2': {
    basePrice: 0.08,
    unit: 'per_image',
    resolutionMultipliers: {
      '0.5K': 0.75,
      '1K': 1,
      '2K': 1,
      '4K': 2,
    },
    surcharges: {
      webSearch: 0.015,
    },
    pricingNotes:
      'Your request will cost **$0.08** per image. For **$1.00**, you can run this model **12** times. 2K and 4K outputs will be charged at **1.5** times and **2** times the standard rate, respectively. 0.5K (512px) resolution outputs will be charged at **0.75** times the standard rate. If web search is used, an additional $0.015 will be charged. **Note: Pricing is subject to change.**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana-pro': {
    basePrice: 0.15,
    unit: 'per_image',
    resolutionMultipliers: {
      '4K': 2,
    },
    surcharges: {
      webSearch: 0.015,
    },
    pricingNotes:
      'Your request will cost **$0.15** per image. For **$1.00**, you can run this model **7** times. 4K outputs will be charged at double the standard rate. If web search is used, an additional $0.015 will be charged. Note: Pricing may change in the future.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana-pro/edit': {
    basePrice: 0.15,
    unit: 'per_image',
    resolutionMultipliers: {
      '4K': 2,
    },
    surcharges: {
      webSearch: 0.015,
    },
    pricingNotes:
      'Your request will cost **$0.15** per image. For **$1.00**, you can run this model **7** times. 4K outputs will be charged at double the standard rate. If web search is used, an additional $0.015 will be charged. Note: Pricing may change in the future.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/recraft/v3/text-to-image': {
    basePrice: 0.04,
    unit: 'per_image',
    styleMultipliers: {
      vector_illustration: 2,
      vector: 2,
    },
    pricingNotes:
      'Your request will cost **$0.04** per image (or **$0.08** if you are using a vector style). For $1 you can run this model approximately **25** times.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'xai/grok-imagine-image': {
    basePrice: 0.02,
    unit: 'per_image',
    pricingNotes:
      '- **Price**: $0.02 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
};

// ============================================================================
// Video Pricing
// ============================================================================

type VideoPricingBase = { pricingNotes?: string };

type VideoPricingPerSecond = VideoPricingBase & {
  mode: 'per_second';
  basePrice: number;
  noAudioMultiplier?: number;
  audioMultiplier?: number;
  voiceControlMultiplier?: number;
  resolutionPricing?: Record<string, number>;
  resolutionAudioPricing?: Record<
    string,
    { noAudio: number; withAudio: number }
  >;
  surcharges?: { imageInput?: number };
};

type VideoPricingPerToken = VideoPricingBase & {
  mode: 'per_token';
  pricePerMillionTokens: number;
};

export type VideoPricing = VideoPricingPerSecond | VideoPricingPerToken;

export const VIDEO_PRICING: Record<string, VideoPricing> = {
  'fal-ai/bytedance/seedance/v1/pro/image-to-video': {
    mode: 'per_token',
    pricePerMillionTokens: 2.5,
    pricingNotes:
      'Each 1080p 5 second video costs roughly **$0.62**. For other resolutions, 1 million video tokens costs **$2.5**. tokens(video)  = (height x width x FPS x duration) / 1024. \n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-video/o1/image-to-video': {
    mode: 'per_second',
    basePrice: 0.112,
    pricingNotes:
      '- **Price**: $0.112 per seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video': {
    mode: 'per_second',
    basePrice: 0.07,
    pricingNotes:
      'For **5s** video your request will cost **$0.35**. For every additional second you will be charged **$0.07.**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-video/v3/pro/image-to-video': {
    mode: 'per_second',
    basePrice: 0.14,
    noAudioMultiplier: 0.8,
    audioMultiplier: 1.2,
    voiceControlMultiplier: 1.4,
    pricingNotes:
      'For every second of video you generated, you will be charged **$0.112** (audio off) or **$0.168** (audio on), if voice control is used while generating audio you will be charged **$0.196**. For example, a 5s video with audio on and voice control will cost **$0.98**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/sora-2/image-to-video': {
    mode: 'per_second',
    basePrice: 0.1,
    pricingNotes:
      'The pricing is $0.1/s for Sora 2.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/veo3': {
    mode: 'per_second',
    basePrice: 0.4,
    pricingNotes:
      'For every second of video you generated, you will be charged **$0.20** (audio off) or **$0.40** (audio on). For example, a **5s video** with audio on will cost **$2**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/veo3.1/image-to-video': {
    mode: 'per_second',
    basePrice: 0.4,
    resolutionAudioPricing: {
      '720p': {
        noAudio: 0.2,
        withAudio: 0.4,
      },
      '1080p': {
        noAudio: 0.2,
        withAudio: 0.4,
      },
      '4K': {
        noAudio: 0.4,
        withAudio: 0.6,
      },
    },
    pricingNotes:
      'For every second of video you generate you will be charged **$0.20** without audio or **$0.40** with audio for 720p or 1080p. At 4k, you will be charged **$0.40** per second without audio, or **$0.60** with. For example, a **5 second video** at **1080p** with **audio on** will cost **$2.00**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'wan/v2.6/image-to-video/flash': {
    mode: 'per_second',
    basePrice: 0.05,
    resolutionPricing: {
      '720p': 0.05,
      '1080p': 0.075,
    },
    pricingNotes:
      'Your request will cost  **$0.05** per second for **720p**, **$0.075** per second for **1080p**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'xai/grok-imagine-video/image-to-video': {
    mode: 'per_second',
    basePrice: 0.05,
    resolutionPricing: {
      '480p': 0.05,
      '720p': 0.07,
    },
    surcharges: {
      imageInput: 0.002,
    },
    pricingNotes:
      'A 6s 480p video will cost **$0.302** (**$0.05** per second of 480p video + **$0.002** for image input). At an output resolution of 480p, every second costs **$0.05**, and at 720p, every second costs **$0.07**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
};

// ============================================================================
// Audio Pricing
// ============================================================================

type AudioPricingUnit = 'per_second' | 'per_minute' | 'per_compute_second';

export type AudioPricing = {
  basePrice: number;
  unit: AudioPricingUnit;
  roundUpToMinute?: boolean;
  pricingNotes?: string;
};

export const AUDIO_PRICING: Record<string, AudioPricing> = {
  'beatoven/music-generation': {
    basePrice: 0.00125,
    unit: 'per_compute_second',
    pricingNotes:
      '- **Price**: $0.1 per requests\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/ace-step/audio-to-audio': {
    basePrice: 0.0002,
    unit: 'per_second',
    pricingNotes:
      'Your request will cost $0.0002 per second of generated audio. For $1 you can run generate 5000 seconds (83 minutes) of music from lyrics.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/ace-step/prompt-to-audio': {
    basePrice: 0.0002,
    unit: 'per_second',
    pricingNotes:
      'Your request will cost $0.0002 per second of generated audio. For $1 you can run generate 5000 seconds (83 minutes) of music from lyrics.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/elevenlabs/music': {
    basePrice: 0.8,
    unit: 'per_minute',
    roundUpToMinute: true,
    pricingNotes:
      'Your request will cost **$0.8** per output audio minute. The audio will be **rounded up** to the closest minute. For instance, a generation with 30 seconds output will be billed as 1 minute.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/elevenlabs/sound-effects': {
    basePrice: 0.002,
    unit: 'per_second',
    pricingNotes:
      '- **Price**: $0.002 per seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/mmaudio-v2': {
    basePrice: 0.001,
    unit: 'per_second',
    pricingNotes:
      '- **Price**: $0.001 per seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
};

export const PRICING_LAST_UPDATED = '2026-03-10T07:24:08.507Z';
