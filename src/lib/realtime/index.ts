import { getRedis } from '@/lib/db/redis';
import { Realtime } from '@upstash/realtime';
import { z } from 'zod';

/**
 * Realtime event schema for generation progress streaming.
 *
 * Events are organized by category:
 * - generation.* - Events for the overall generation process
 */
export const realtimeSchema = {
  generation: {
    // Phase lifecycle events
    'phase:start': z.object({
      phase: z.number(),
      phaseName: z.string(),
    }),
    'phase:complete': z.object({
      phase: z.number(),
    }),

    // Scene events (progressive display during analysis)
    'scene:new': z.object({
      sceneId: z.string(),
      sceneNumber: z.number(),
      title: z.string(),
      scriptExtract: z.string(),
      durationSeconds: z.number(),
    }),

    // Frame events (after DB write)
    'frame:created': z.object({
      frameId: z.string(),
      sceneId: z.string(),
      orderIndex: z.number(),
    }),

    // Frame updated with prompts (visual, motion, audio)
    'frame:updated': z.object({
      frameId: z.string(),
      updateType: z.enum(['visual-prompt', 'motion-prompt', 'audio-design']),
      metadata: z.unknown(), // Full Scene object with prompts
    }),

    // Image generation progress
    'image:progress': z.object({
      frameId: z.string(),
      status: z.enum(['pending', 'generating', 'completed', 'failed']),
      thumbnailUrl: z.string().optional(),
    }),

    // Image generation progress
    'variant-image:progress': z.object({
      frameId: z.string(),
      status: z.enum(['pending', 'generating', 'completed', 'failed']),
      variantImageUrl: z.string().optional(),
    }),

    // Video generation progress
    'video:progress': z.object({
      frameId: z.string(),
      status: z.enum(['pending', 'generating', 'completed', 'failed']),
      videoUrl: z.string().optional(),
    }),

    // Sequence events
    updated: z.object({
      title: z.string().optional(),
    }),
    failed: z.object({
      message: z.string(),
    }),
    // Terminal events
    complete: z.object({
      sequenceId: z.string(),
    }),
    error: z.object({
      message: z.string(),
      phase: z.number().optional(),
    }),
  },
};

let realtimeInstance: ReturnType<typeof createRealtime> | null = null;

function createRealtime() {
  const redis = getRedis();
  return new Realtime({ schema: realtimeSchema, redis });
}

/**
 * Get the Realtime instance for emitting/subscribing to events.
 * Lazily initialized to avoid errors when Redis env vars are not set.
 */
export function getRealtime() {
  if (realtimeInstance) return realtimeInstance;
  realtimeInstance = createRealtime();
  return realtimeInstance;
}

/**
 * Get a channel for a specific sequence to emit/receive events.
 * @param sequenceId - The sequence ID to use as the channel identifier
 */
export function getGenerationChannel(sequenceId?: string) {
  return sequenceId
    ? getRealtime().channel(sequenceId)
    : {
        emit: () => null,
      };
}

// Export the schema type for type inference
type RealtimeSchema = typeof realtimeSchema;
