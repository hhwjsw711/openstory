/**
 * Music Generation Service
 * Handles text-to-music generation using Fal.ai audio models (ACE-Step)
 */

import {
  AUDIO_MODEL_KEYS,
  AUDIO_MODELS,
  DEFAULT_MUSIC_MODEL,
  type AudioModel,
  type AudioModelConfig,
} from '@/lib/ai/models';
import { getEnv } from '#env';
import { startObservation } from '@langfuse/tracing';
import { createFalClient } from '@fal-ai/client';
import { z } from 'zod';

export const generateMusicOptionsSchema = z.object({
  prompt: z.string().min(1),
  tags: z.string().optional(),
  lyrics: z.string().optional(),
  duration: z.number().min(1).max(240).optional(),
  instrumental: z.boolean().optional().default(true),
  model: z.enum(AUDIO_MODEL_KEYS).optional().default(DEFAULT_MUSIC_MODEL),
  steps: z.number().optional(),
});

export type GenerateMusicOptions = {
  /** Style/mood prompt for the music (e.g., "tense orchestral, dark atmosphere") */
  prompt: string;
  /** Comma-separated genre tags (e.g., "orchestral, ambient, cinematic") */
  tags?: string;
  /** Lyrics to sing. Use [inst] for instrumental. Supports [verse], [chorus], [bridge] structure. */
  lyrics?: string;
  /** Duration in seconds (1-240, default: 60) */
  duration?: number;
  /** Generate instrumental only (default: true) */
  instrumental?: boolean;
  /** Audio model to use */
  model?: AudioModel;
  /** Number of diffusion steps (default: 27) */
  steps?: number;
  /** Langfuse trace name */
  traceName?: string;
  /** Override Fal.ai API key */
  falApiKey?: string;
};

export type MusicResult = {
  success: boolean;
  audioUrl?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  requestId?: string;
};

/**
 * Provider-specific input builders for audio models
 */
type AudioProviderInputBuilder = (
  options: GenerateMusicOptions,
  modelConfig: AudioModelConfig
) => Record<string, unknown>;

const AUDIO_PROVIDER_INPUT_BUILDERS: Record<string, AudioProviderInputBuilder> =
  {
    'ace-step': (options, modelConfig) => {
      const duration = options.duration
        ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
        : modelConfig.capabilities.defaultDuration;

      // ACE-Step uses [inst] marker for instrumental
      const lyrics =
        options.instrumental && !options.lyrics
          ? '[inst]'
          : (options.lyrics ?? '[inst]');

      return {
        prompt: options.tags ?? options.prompt,
        lyrics,
        duration,
        steps: options.steps ?? 27,
        scheduler: 'euler',
        cfg_type: 'apg',
      };
    },

    elevenlabs: (options, modelConfig) => {
      const duration = options.duration
        ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
        : modelConfig.capabilities.defaultDuration;

      return {
        text: options.prompt,
        duration_seconds: duration,
      };
    },

    mmaudio: (options, modelConfig) => {
      const duration = options.duration
        ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
        : modelConfig.capabilities.defaultDuration;

      return {
        prompt: options.prompt,
        duration: duration,
        num_steps: 25,
      };
    },

    'elevenlabs-music': (options, modelConfig) => {
      const duration = options.duration
        ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
        : modelConfig.capabilities.defaultDuration;
      return {
        prompt: options.prompt,
        music_length_ms: duration * 1000,
        force_instrumental: options.instrumental ?? true,
      };
    },

    beatoven: (options, modelConfig) => {
      const duration = options.duration
        ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
        : modelConfig.capabilities.defaultDuration;
      return {
        prompt: options.prompt,
        duration,
      };
    },
  };

/**
 * Generate music/audio using Fal.ai
 * Uses fal.subscribe() for queue-based generation with status tracking
 */
export async function generateMusicForScene(
  options: GenerateMusicOptions
): Promise<MusicResult> {
  const modelKey = options.model || DEFAULT_MUSIC_MODEL;
  const modelConfig = AUDIO_MODELS[modelKey];

  if (!modelConfig) {
    throw new Error(`Invalid audio model: ${modelKey}`);
  }

  const span = startObservation(
    options.traceName ?? 'fal-music',
    {
      model: modelKey,
      input: {
        prompt: options.prompt,
        tags: options.tags,
        duration: options.duration,
        instrumental: options.instrumental,
      },
    },
    { asType: 'generation' }
  );

  try {
    const result = await generateMusicInternal(options, modelConfig);

    span
      .update({
        output: {
          audioUrl: result.audioUrl,
        },
        costDetails:
          typeof result.metadata?.cost === 'number'
            ? { total: result.metadata.cost }
            : undefined,
      })
      .end();
    return result;
  } catch (error) {
    span
      .update({
        level: 'ERROR',
        statusMessage: error instanceof Error ? error.message : String(error),
      })
      .end();
    throw error;
  }
}

/**
 * Internal music generation implementation
 */
async function generateMusicInternal(
  options: GenerateMusicOptions,
  modelConfig: AudioModelConfig
): Promise<MusicResult> {
  const inputBuilder = AUDIO_PROVIDER_INPUT_BUILDERS[modelConfig.provider];

  if (!inputBuilder) {
    throw new Error(
      `No input builder found for audio provider: ${modelConfig.provider}`
    );
  }

  const input = inputBuilder(options, modelConfig);

  console.log(
    `[Music Service] Generating music with model: ${modelConfig.id}`,
    {
      provider: modelConfig.provider,
      promptLength: options.prompt?.length,
      duration: input.duration,
    }
  );

  let requestId: string | undefined;

  const fal = createFalClient({
    credentials: options.falApiKey ?? getEnv().FAL_KEY ?? '',
  });

  const result = await fal.subscribe(modelConfig.id, {
    input,
    logs: true,
    pollInterval: 5000,
    onEnqueue: (reqId: string) => {
      requestId = reqId;
      console.log(`[Music Service] Request enqueued: ${reqId}`);
    },
    onQueueUpdate: (update) => {
      if (update.status === 'IN_QUEUE' && 'queue_position' in update) {
        console.log(`[Music Service] Queue position: ${update.queue_position}`);
      }
      if (update.status === 'IN_PROGRESS') {
        console.log(`[Music Service] Generation in progress...`);
      }
      if (update.status === 'COMPLETED') {
        console.log(
          `[Music Service] Generation completed in ${update.metrics?.inference_time || 'unknown'}s`
        );
      }
    },
  });

  console.log('[Music Service] Result:', JSON.stringify(result, null, 2));

  // Extract audio URL from result
  // ACE-Step returns { audio_file: { url, content_type, file_name, file_size } }
  const resultObj = result && typeof result === 'object' ? result : null;
  const data =
    resultObj && 'data' in resultObj && typeof resultObj.data === 'object'
      ? resultObj.data
      : null;

  // Try multiple response shapes: audio_file.url, audio.url
  let audioUrl: string | undefined;
  if (data) {
    if (
      'audio_file' in data &&
      data.audio_file &&
      typeof data.audio_file === 'object' &&
      'url' in data.audio_file &&
      typeof data.audio_file.url === 'string'
    ) {
      audioUrl = data.audio_file.url;
    } else if (
      'audio' in data &&
      data.audio &&
      typeof data.audio === 'object' &&
      'url' in data.audio &&
      typeof data.audio.url === 'string'
    ) {
      audioUrl = data.audio.url;
    }
  }

  if (!audioUrl) {
    console.error('[Music Service] No audio URL in result:', result);
    throw new Error('No audio URL returned from music generation');
  }

  if (
    !requestId &&
    resultObj &&
    'requestId' in resultObj &&
    typeof resultObj.requestId === 'string'
  ) {
    requestId = resultObj.requestId;
  }

  const validatedDuration =
    options.duration || modelConfig.capabilities.defaultDuration;
  const estimatedCost = modelConfig.pricing.pricePerSecond * validatedDuration;

  return {
    success: true,
    audioUrl,
    requestId,
    metadata: {
      model: modelConfig.id,
      provider: modelConfig.provider,
      duration: validatedDuration,
      cost: estimatedCost,
      generatedAt: new Date().toISOString(),
    },
  };
}
