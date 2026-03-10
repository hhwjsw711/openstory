// AUTO-GENERATED — do not edit manually. Run: bun scripts/update-fal-pricing.ts
export const FAL_PRICING: Record<
  string,
  { unitPrice: number; unit: string; pricingNotes?: string }
> = {
  'beatoven/music-generation': {
    unitPrice: 0.00125,
    unit: 'compute seconds',
    pricingNotes:
      '- **Price**: $0.1 per requests\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/ace-step/audio-to-audio': {
    unitPrice: 0.0002,
    unit: 'seconds',
    pricingNotes:
      'Your request will cost $0.0002 per second of generated audio. For $1 you can run generate 5000 seconds (83 minutes) of music from lyrics.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/ace-step/prompt-to-audio': {
    unitPrice: 0.0002,
    unit: 'seconds',
    pricingNotes:
      'Your request will cost $0.0002 per second of generated audio. For $1 you can run generate 5000 seconds (83 minutes) of music from lyrics.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/bytedance/seedance/v1/pro/image-to-video': {
    unitPrice: 2.5,
    unit: '1m tokens',
    pricingNotes:
      'Each 1080p 5 second video costs roughly **$0.62**. For other resolutions, 1 million video tokens costs **$2.5**. tokens(video)  = (height x width x FPS x duration) / 1024. \n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/bytedance/seedream/v4.5/text-to-image': {
    unitPrice: 0.04,
    unit: 'images',
    pricingNotes:
      '- **Price**: $0.04 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/elevenlabs/music': {
    unitPrice: 0.8,
    unit: 'minutes',
    pricingNotes:
      'Your request will cost **$0.8** per output audio minute. The audio will be **rounded up** to the closest minute. For instance, a generation with 30 seconds output will be billed as 1 minute.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/elevenlabs/sound-effects': {
    unitPrice: 0.002,
    unit: 'seconds',
    pricingNotes:
      '- **Price**: $0.002 per seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/fast-lightning-sdxl': {
    unitPrice: 0.00125,
    unit: 'compute seconds',
    pricingNotes:
      '- **Price**: $0 per compute seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/fast-sdxl': {
    unitPrice: 0.00125,
    unit: 'compute seconds',
    pricingNotes:
      '- **Price**: $0 per compute seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-2': {
    unitPrice: 0.012,
    unit: 'megapixels',
    pricingNotes:
      '- **Price**: $0.012 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-2/klein/4b': {
    unitPrice: 0.009,
    unit: 'megapixels',
    pricingNotes:
      '- **Price**: $0.005 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-krea-lora': {
    unitPrice: 0.035,
    unit: 'megapixels',
    pricingNotes:
      '- **Price**: $0.035 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-pro': {
    unitPrice: 0.05,
    unit: 'megapixels',
    pricingNotes:
      '- **Price**: $0.05 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux-pro/v1.1-ultra': {
    unitPrice: 0.06,
    unit: 'images',
    pricingNotes:
      '- **Price**: $0.06 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux/dev': {
    unitPrice: 0.025,
    unit: 'megapixels',
    pricingNotes:
      '- **Price**: $0.025 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/flux/schnell': {
    unitPrice: 0.003,
    unit: 'megapixels',
    pricingNotes:
      '- **Price**: $0.003 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/gpt-image-1.5': {
    unitPrice: 1,
    unit: 'units',
    pricingNotes:
      "Your request will cost different amounts based on the number of images, quality, and size.\n\n- You will be charged $0.005 per 1,000 input text tokens. One word is roughly 4 tokens.\n-  You will be charged $0.010 per 1,000 output text tokens. The model will consume tokens reasoning about your prompt based on it's complexity.\n- For **low** quality, you will be charged $0.009 for 1024x1024 or $0.013 for any other size *per image*. \n- For **medium** quality, you will be charged $0.034 for 1024x1024, $0.051 for 1024x1536 and $0.050 for 1536x1024 *per image*.\n- For **high** quality, you will be charged $0.133 for 1024x1024, $0.200 for 1024x1536 or $0.199 for 1536x1024 *per image*.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).",
  },
  'fal-ai/hidream-i1-full': {
    unitPrice: 0.05,
    unit: 'megapixels',
    pricingNotes:
      '- **Price**: $0.05 per megapixels\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/imagen4/preview/ultra': {
    unitPrice: 0.06,
    unit: 'images',
    pricingNotes:
      '- **Price**: $0.06 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-image/v3/text-to-image': {
    unitPrice: 0.028,
    unit: 'images',
    pricingNotes:
      '- **Price**: $0.028 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-video/o1/image-to-video': {
    unitPrice: 0.112,
    unit: 'seconds',
    pricingNotes:
      '- **Price**: $0.112 per seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video': {
    unitPrice: 0.07,
    unit: 'seconds',
    pricingNotes:
      'For **5s** video your request will cost **$0.35**. For every additional second you will be charged **$0.07.**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/kling-video/v3/pro/image-to-video': {
    unitPrice: 0.14,
    unit: 'seconds',
    pricingNotes:
      'For every second of video you generated, you will be charged **$0.224** (audio off) or **$0.336** (audio on), if voice control is used while generating audio you will be charged **$0.392**. For example, a 5s video with audio on and voice control will cost **$1.96**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/mmaudio-v2': {
    unitPrice: 0.001,
    unit: 'seconds',
    pricingNotes:
      '- **Price**: $0.001 per seconds\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana': {
    unitPrice: 0.0398,
    unit: 'images',
    pricingNotes:
      'Your request will cost **$0.039** per image. For **$1.00**, you can run this model **25 times.**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana-2': {
    unitPrice: 0.08,
    unit: 'images',
    pricingNotes:
      'Your request will cost **$0.08** per image. For **$1.00**, you can run this model **12** times. 2K and 4K outputs will be charged at **1.5** times and **2** times the standard rate, respectively. 0.5K (512px) resolution outputs will be charged at **0.75** times the standard rate. If web search is used, an additional $0.015 will be charged. **Note: Pricing is subject to change.**\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana-pro': {
    unitPrice: 0.15,
    unit: 'images',
    pricingNotes:
      'Your request will cost **$0.15** per image. For **$1.00**, you can run this model **7** times. 4K outputs will be charged at double the standard rate. If web search is used, an additional $0.015 will be charged. Note: Pricing may change in the future.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/nano-banana-pro/edit': {
    unitPrice: 0.15,
    unit: 'images',
    pricingNotes:
      'Your request will cost **$0.15** per image. For **$1.00**, you can run this model **7** times. 4K outputs will be charged at double the standard rate. If web search is used, an additional $0.015 will be charged. Note: Pricing may change in the future.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/recraft/v3/text-to-image': {
    unitPrice: 0.04,
    unit: 'images',
    pricingNotes:
      'Your request will cost **$0.04** per image (or **$0.08** if you are using a vector style). For $1 you can run this model approximately **25** times.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/sora-2/image-to-video': {
    unitPrice: 0.1,
    unit: 'seconds',
    pricingNotes:
      'The pricing is $0.1/s for Sora 2.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/veo3': {
    unitPrice: 0.4,
    unit: 'seconds',
    pricingNotes:
      'For every second of video you generated, you will be charged **$0.20** (audio off) or **$0.40** (audio on). For example, a **5s video** with audio on will cost **$2**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'fal-ai/veo3.1/image-to-video': {
    unitPrice: 0.4,
    unit: 'seconds',
    pricingNotes:
      'For every second of video you generate you will be charged **$0.20** without audio or **$0.40** with audio for 720p or 1080p. At 4k, you will be charged **$0.40** per second without audio, or **$0.60** with. For example, a **5 second video** at **1080p** with **audio on** will cost **$2.00**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'wan/v2.6/image-to-video/flash': {
    unitPrice: 0.05,
    unit: 'seconds',
    pricingNotes:
      'Your request will cost  **$0.05** per second for **720p**, **$0.075** per second for **1080p**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'xai/grok-imagine-image': {
    unitPrice: 0.02,
    unit: 'images',
    pricingNotes:
      '- **Price**: $0.02 per images\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
  'xai/grok-imagine-video/image-to-video': {
    unitPrice: 0.05,
    unit: 'seconds',
    pricingNotes:
      'A 6s 480p video will cost **$0.302** (**$0.05** per second of 480p video + **$0.002** for image input). At an output resolution of 480p, every second costs **$0.05**, and at 720p, every second costs **$0.07**.\n\nFor more details, see [fal.ai pricing](https://fal.ai/pricing).',
  },
};

export const PRICING_LAST_UPDATED = '2026-03-10T01:19:06.428Z';
