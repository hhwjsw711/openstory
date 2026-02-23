import {
  AUDIO_MODEL_KEYS,
  AUDIO_MODELS,
  DEFAULT_MUSIC_MODEL,
  type AudioModel,
  type AudioModelConfig,
} from '@/lib/ai/models';
import { calculateFalCost } from '@/lib/ai/fal-cost';
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
  /** Lyrics with [verse], [chorus], [bridge] structure. Use [inst] for instrumental. */
  lyrics?: string;
  /** Duration in seconds (1-240, default: 60) */
  duration?: number;
  /** Generate instrumental only (default: true) */
  instrumental?: boolean;
  model?: AudioModel;
  /** Number of diffusion steps (default: 27) */
  steps?: number;
  traceName?: string;
  falApiKey?: string;
};

export type MusicResult = {
  success: boolean;
  audioUrl?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  requestId?: string;
};

function clampDuration(
  requested: number | undefined,
  config: AudioModelConfig
): number {
  if (!requested) return config.capabilities.defaultDuration;
  return Math.min(requested, config.capabilities.maxDuration);
}

const AUDIO_PROVIDER_INPUT_BUILDERS: Record<
  string,
  (
    options: GenerateMusicOptions,
    config: AudioModelConfig
  ) => Record<string, unknown>
> = {
  'ace-step': (options, config) => {
    const lyrics =
      options.instrumental && !options.lyrics
        ? '[inst]'
        : (options.lyrics ?? '[inst]');

    return {
      prompt: options.tags ?? options.prompt,
      lyrics,
      duration: clampDuration(options.duration, config),
      steps: options.steps ?? 27,
      scheduler: 'euler',
      cfg_type: 'apg',
    };
  },

  elevenlabs: (options, config) => ({
    text: options.prompt,
    duration_seconds: clampDuration(options.duration, config),
  }),

  mmaudio: (options, config) => ({
    prompt: options.prompt,
    duration: clampDuration(options.duration, config),
    num_steps: 25,
  }),

  'elevenlabs-music': (options, config) => ({
    prompt: options.prompt,
    music_length_ms: clampDuration(options.duration, config) * 1000,
    force_instrumental: options.instrumental ?? true,
  }),

  beatoven: (options, config) => ({
    prompt: options.prompt,
    duration: clampDuration(options.duration, config),
  }),
};

/**
 * Extract audio URL from fal.ai response data.
 * Models return audio in different shapes: `audio_file.url` or `audio.url`.
 */
function hasKey<K extends string>(
  obj: object,
  key: K
): obj is Record<K, unknown> {
  return key in obj;
}

function extractAudioUrl(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  for (const key of ['audio_file', 'audio'] as const) {
    if (!hasKey(data, key)) continue;
    const field = data[key];
    if (typeof field === 'object' && field !== null && hasKey(field, 'url')) {
      if (typeof field.url === 'string') return field.url;
    }
  }
  return undefined;
}

/**
 * Generate music/audio using Fal.ai with queue-based status tracking.
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
    const result = await callFalAudio(options, modelConfig);

    span
      .update({
        output: { audioUrl: result.audioUrl },
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

async function callFalAudio(
  options: GenerateMusicOptions,
  modelConfig: AudioModelConfig
): Promise<MusicResult> {
  const inputBuilder = AUDIO_PROVIDER_INPUT_BUILDERS[modelConfig.provider];
  if (!inputBuilder) {
    throw new Error(
      `No input builder for audio provider: ${modelConfig.provider}`
    );
  }

  const input = inputBuilder(options, modelConfig);

  console.log(
    `[Music Service] Generating music with model: ${modelConfig.id}`,
    {
      provider: modelConfig.provider,
      promptLength: options.prompt.length,
      duration: input.duration,
    }
  );

  const fal = createFalClient({
    credentials: options.falApiKey ?? getEnv().FAL_KEY ?? '',
  });

  const result = await fal.subscribe(modelConfig.id, {
    input,
    logs: true,
    pollInterval: 5000,
    onEnqueue: (reqId: string) => {
      console.log(`[Music Service] Request enqueued: ${reqId}`);
    },
    onQueueUpdate: (update) => {
      if (update.status === 'IN_QUEUE' && 'queue_position' in update) {
        console.log(`[Music Service] Queue position: ${update.queue_position}`);
      } else if (update.status === 'IN_PROGRESS') {
        console.log(`[Music Service] Generation in progress...`);
      } else if (update.status === 'COMPLETED') {
        console.log(
          `[Music Service] Completed in ${update.metrics?.inference_time || 'unknown'}s`
        );
      }
    },
  });

  const audioUrl = extractAudioUrl(result.data);

  if (!audioUrl) {
    console.error('[Music Service] No audio URL in result:', result);
    throw new Error('No audio URL returned from music generation');
  }

  const duration = options.duration ?? modelConfig.capabilities.defaultDuration;
  const cost = await calculateFalCost(
    modelConfig.id,
    duration,
    'seconds',
    options.falApiKey
  );

  return {
    success: true,
    audioUrl,
    requestId: result.requestId,
    metadata: {
      model: modelConfig.id,
      provider: modelConfig.provider,
      duration,
      cost,
      generatedAt: new Date().toISOString(),
    },
  };
}
