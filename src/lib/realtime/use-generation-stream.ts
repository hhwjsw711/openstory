'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useReducer } from 'react';
import { useRealtime } from './client';
import {
  generationStreamReducer,
  GenerationStreamState,
  initialGenerationStreamState,
} from './generation-stream.reducer';
import { updateQueryCacheFromEvent } from './query-cache-updater';

type GenerationEvent = {
  event: string;
  data: unknown;
};

/**
 * Hook for subscribing to real-time generation events for a sequence.
 *
 * @param sequenceId - The sequence ID to subscribe to
 * @param enabled - Whether to enable the subscription (default: true)
 * @returns Generation stream state with scenes, frames, and phase progress
 *
 * @example
 * ```tsx
 * const { state, status, reset } = useGenerationStream(sequenceId, {
 *   enabled: sequence.status === 'processing',
 * });
 *
 * // Show progress indicator
 * <PhaseIndicator phases={state.phases} currentPhase={state.currentPhase} />
 *
 * // Show streaming scenes
 * {state.scenes.map((scene) => (
 *   <SceneCard key={scene.sceneId} scene={scene} />
 * ))}
 * ```
 */
export function useGenerationStream(sequenceId?: string) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(
    generationStreamReducer,
    initialGenerationStreamState
  );

  // Handle incoming events
  const handleEvent = useCallback(
    (event: GenerationEvent) => {
      const { event: eventName, data } = event;

      // Update TanStack Query cache for data-related events
      if (sequenceId) {
        updateQueryCacheFromEvent(
          queryClient,
          sequenceId,
          eventName,
          data as Record<string, unknown>
        );
      }

      switch (eventName) {
        case 'generation.phase:start':
          dispatch({
            type: 'PHASE_START',
            payload: data as {
              phase: number;
              phaseName: string;
              totalPhases: number;
            },
          });
          break;

        case 'generation.phase:complete':
          dispatch({
            type: 'PHASE_COMPLETE',
            payload: data as { phase: number },
          });
          break;

        case 'generation.scene:new':
          dispatch({
            type: 'SCENE_NEW',
            payload: data as {
              sceneId: string;
              sceneNumber: number;
              title: string;
              scriptExtract: string;
              durationSeconds: number;
            },
          });
          break;

        case 'generation.frame:created':
          dispatch({
            type: 'FRAME_CREATED',
            payload: data as {
              frameId: string;
              sceneId: string;
              orderIndex: number;
            },
          });
          break;

        case 'generation.image:progress':
          dispatch({
            type: 'IMAGE_PROGRESS',
            payload: data as {
              frameId: string;
              status: 'pending' | 'generating' | 'completed' | 'failed';
              thumbnailUrl?: string;
            },
          });
          break;

        case 'generation.video:progress':
          dispatch({
            type: 'VIDEO_PROGRESS',
            payload: data as {
              frameId: string;
              status: 'pending' | 'generating' | 'completed' | 'failed';
              videoUrl?: string;
            },
          });
          break;

        case 'generation.complete':
          dispatch({
            type: 'COMPLETE',
            payload: data as { sequenceId: string },
          });
          break;

        case 'generation.failed':
          dispatch({
            type: 'FAILED',
            payload: data as { message: string },
          });
          break;

        case 'generation.error':
          dispatch({
            type: 'ERROR',
            payload: data as { message: string; phase?: number },
          });
          break;
      }
    },
    [queryClient, sequenceId]
  );

  // Subscribe to realtime events
  // Only include the channel if sequenceId is defined to avoid invalid subscriptions
  const { status } = useRealtime({
    channels: sequenceId ? [sequenceId] : [],
    events: [
      'generation.phase:start',
      'generation.phase:complete',
      'generation.scene:new',
      'generation.frame:created',
      'generation.frame:updated',
      'generation.image:progress',
      'generation.video:progress',
      'generation.complete',
      'generation.failed',
      'generation.updated',
      'generation.error',
    ] as const,
    onData: handleEvent,
    enabled: !!sequenceId, // Only subscribe if sequenceId is defined
  });

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    status,
    reset,
  };
}

export type { GenerationStreamState };
