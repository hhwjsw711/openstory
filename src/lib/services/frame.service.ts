/**
 * Frame Service Layer
 *
 * Handles all frame-related business logic including CRUD operations,
 * frame generation orchestration, and reordering. This service contains
 * pure business logic with no authentication checks (caller's responsibility).
 *
 * @module lib/services/frame.service
 */

import type { Scene } from '@/lib/ai/scene-analysis.schema';
import { db } from '@/lib/db/client';
import {
  createFrame as createFrameHelper,
  createFramesBulk,
  deleteFrame as deleteFrameHelper,
  deleteSequenceFrames,
  getSequenceFrames,
  updateFrame as updateFrameHelper,
} from '@/lib/db/helpers/frames';
import type { Frame, NewFrame } from '@/lib/db/schema';
import { frames } from '@/lib/db/schema';
import { ValidationError } from '@/lib/errors';
import type {
  CreateFrameInput,
  UpdateFrameInput,
} from '@/lib/schemas/frame.schemas';
import { and, eq } from 'drizzle-orm';

// Type definitions - using Zod-inferred types for consistency with API validation
export type CreateFrameParams = CreateFrameInput;

export type UpdateFrameParams = { id: string } & UpdateFrameInput;

export interface GenerateFramesParams {
  sequenceId: string;
  userId: string;
  options?: {
    framesPerScene?: number;
    generateThumbnails?: boolean;
    generateDescriptions?: boolean;
    aiProvider?: 'openai' | 'anthropic' | 'openrouter';
    regenerateAll?: boolean;
  };
}

export interface FrameGenerationResult {
  frameCount: number;
  jobId?: string;
  message: string;
}

/**
 * Frame Service Class
 *
 * Provides business logic for frame operations. All methods assume
 * the caller has already verified authentication and authorization.
 */
export class FrameService {
  /**
   * Create a new frame
   *
   * @param params - Frame creation parameters (validated by CreateFrameInput schema)
   * @throws {Error} If database operation fails
   * @returns The created frame
   */
  async createFrame(params: CreateFrameParams): Promise<Frame> {
    return await createFrameHelper(params);
  }

  /**
   * Update an existing frame
   *
   * @param params - Frame update parameters (validated by UpdateFrameInput schema)
   * @throws {ValidationError} If frame not found
   * @throws {Error} If database operation fails
   * @returns The updated frame
   */
  async updateFrame(params: UpdateFrameParams): Promise<Frame> {
    const { id, ...updateData } = params;
    return await updateFrameHelper(id, updateData);
  }

  /**
   * Delete a frame
   *
   * @param frameId - The frame ID to delete
   * @throws {Error} If database operation fails
   * @returns The sequence ID of the deleted frame (for cache revalidation)
   */
  async deleteFrame(frameId: string): Promise<string> {
    // First get the frame to know its sequenceId
    const [frame] = await db
      .select({ sequenceId: frames.sequenceId })
      .from(frames)
      .where(eq(frames.id, frameId));

    await deleteFrameHelper(frameId);

    return frame?.sequenceId || '';
  }

  /**
   * Get a single frame by ID
   *
   * @param frameId - The frame ID
   * @throws {ValidationError} If frame not found
   * @throws {Error} If database operation fails
   * @returns The frame
   */
  async getFrame(frameId: string): Promise<Frame> {
    const [data] = await db.select().from(frames).where(eq(frames.id, frameId));

    if (!data) {
      throw new ValidationError('Frame not found');
    }

    return data;
  }

  /**
   * Get all frames for a sequence
   *
   * @param sequenceId - The sequence ID
   * @throws {Error} If database operation fails
   * @returns Array of frames ordered by orderIndex
   */
  async getFramesBySequence(sequenceId: string): Promise<Frame[]> {
    return await getSequenceFrames(sequenceId);
  }

  /**
   * Reorder frames in a sequence
   *
   * @param sequenceId - The sequence ID
   * @param frameOrders - Array of frame IDs with their new order indexes
   * @throws {Error} If database operation fails
   */
  async reorderFrames(
    _sequenceId: string,
    frameOrders: Array<{ id: string; order_index: number }>
  ): Promise<void> {
    // Use transaction to update all frames
    await db.transaction(async (tx) => {
      for (const frameOrder of frameOrders) {
        await tx
          .update(frames)
          .set({ orderIndex: frameOrder.order_index, updatedAt: new Date() })
          .where(eq(frames.id, frameOrder.id));
      }
    });
  }

  /**
   * Delete all frames for a sequence
   *
   * @param sequenceId - The sequence ID
   * @throws {Error} If database operation fails
   */
  async deleteFramesBySequence(sequenceId: string): Promise<void> {
    await deleteSequenceFrames(sequenceId);
  }

  /**
   * Bulk insert frames
   *
   * @param frameInserts - Array of frames to insert
   * @throws {Error} If database operation fails
   * @returns Array of inserted frames
   */
  async bulkInsertFrames(frameInserts: NewFrame[]): Promise<Frame[]> {
    try {
      return await createFramesBulk(frameInserts);
    } catch (error) {
      // If we get a unique constraint violation, try upsert instead
      if (
        error instanceof Error &&
        (error.message.includes('duplicate key') ||
          error.message.includes('unique constraint'))
      ) {
        // For upsert, we need to manually handle conflicts
        const upserted = await db.transaction(async (tx) => {
          const results: Frame[] = [];
          for (const frame of frameInserts) {
            const [existing] = await tx
              .select()
              .from(frames)
              .where(
                and(
                  eq(frames.sequenceId, frame.sequenceId),
                  eq(frames.orderIndex, frame.orderIndex)
                )
              );

            if (existing) {
              const [updated] = await tx
                .update(frames)
                .set({ ...frame, updatedAt: new Date() })
                .where(eq(frames.id, existing.id))
                .returning();
              results.push(updated);
            } else {
              const [created] = await tx
                .insert(frames)
                .values(frame)
                .returning();
              results.push(created);
            }
          }
          return results;
        });

        return upserted;
      }

      throw error;
    }
  }

  /**
   * Update frame with thumbnail URL
   *
   * @param frameId - The frame ID
   * @param thumbnailUrl - The thumbnail URL
   * @throws {Error} If database operation fails
   */
  async updateFrameThumbnail(
    frameId: string,
    thumbnailUrl: string
  ): Promise<void> {
    await updateFrameHelper(frameId, { thumbnailUrl });
  }

  /**
   * Update frame with video URL
   *
   * @param frameId - The frame ID
   * @param videoUrl - The video URL
   * @throws {Error} If database operation fails
   */
  async updateFrameVideo(frameId: string, videoUrl: string): Promise<void> {
    await updateFrameHelper(frameId, { videoUrl });
  }

  /**
   * Get scene data from frame metadata
   *
   * @param frame - The frame with metadata
   * @returns Scene object or null if metadata is invalid
   */
  getSceneData(frame: Frame): Scene | null {
    return frame.metadata;
  }

  /**
   * Get visual prompt from frame
   * Prioritizes user-updated prompt over AI-generated prompt
   *
   * @param frame - The frame with metadata
   * @returns Visual prompt string or null if not available
   */
  getVisualPrompt(frame: Frame): string | null {
    // Prioritize user-updated prompt
    if (frame.imagePrompt) {
      return frame.imagePrompt;
    }
    // Fall back to AI-generated prompt from scene analysis
    const scene = frame.metadata;
    return scene?.prompts?.visual?.fullPrompt || null;
  }

  /**
   * Get motion prompt from frame's scene data
   *
   * @param frame - The frame with metadata
   * @returns Motion prompt string or null if not available
   */
  getMotionPrompt(frame: Frame): string | null {
    const scene = frame.metadata;
    return scene?.prompts?.motion?.fullPrompt || null;
  }

  /**
   * Check if frame has valid Scene metadata
   *
   * @param frame - The frame to check
   * @returns True if frame has valid Scene metadata
   */
  hasSceneMetadata(frame: Frame): boolean {
    return frame.metadata !== null;
  }

  /**
   * Enrich a frame with fresh signed URLs from its storage paths
   * Generates temporary signed URLs from permanent R2 paths stored in the database
   *
   * @param frame - The frame to enrich
   * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   * @returns Frame with videoUrl and thumbnailUrl populated from paths
   */
  async enrichFrameWithSignedUrls(
    frame: Frame,
    expiresIn: number = 3600
  ): Promise<Frame> {
    const { getSignedUrl, STORAGE_BUCKETS } = await import(
      '@/lib/db/helpers/storage'
    );

    // Generate signed URL for video if videoPath exists
    let videoUrl = frame.videoUrl;
    if (frame.videoPath) {
      try {
        videoUrl = await getSignedUrl(
          STORAGE_BUCKETS.VIDEOS,
          frame.videoPath,
          expiresIn
        );
      } catch (error) {
        console.error(
          `Failed to generate signed URL for video path ${frame.videoPath}:`,
          error
        );
        // Keep existing URL if generation fails
      }
    }

    // Generate signed URL for thumbnail if thumbnailPath exists
    let thumbnailUrl = frame.thumbnailUrl;
    if (frame.thumbnailPath) {
      try {
        thumbnailUrl = await getSignedUrl(
          STORAGE_BUCKETS.THUMBNAILS,
          frame.thumbnailPath,
          expiresIn
        );
      } catch (error) {
        console.error(
          `Failed to generate signed URL for thumbnail path ${frame.thumbnailPath}:`,
          error
        );
        // Keep existing URL if generation fails
      }
    }

    return {
      ...frame,
      videoUrl,
      thumbnailUrl,
    };
  }

  /**
   * Enrich multiple frames with fresh signed URLs
   *
   * @param frames - Array of frames to enrich
   * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   * @returns Array of frames with signed URLs
   */
  async enrichFramesWithSignedUrls(
    frames: Frame[],
    expiresIn: number = 3600
  ): Promise<Frame[]> {
    return Promise.all(
      frames.map((frame) => this.enrichFrameWithSignedUrls(frame, expiresIn))
    );
  }
}

// Singleton instance
export const frameService = new FrameService();

// ============================================================================
// Scene Completion Tracking Helpers (Functional)
// ============================================================================

/**
 * Status of each phase in the scene analysis pipeline
 */
export interface SceneCompletionStatus {
  hasBasicScene: boolean; // Phase 1: Scene split with metadata
  hasVisualPrompts: boolean; // Phase 3: Visual prompts + variants + continuity
  hasMotionPrompts: boolean; // Phase 4: Motion prompts + movement variants
  hasAudioDesign: boolean; // Phase 5: Audio design
  isComplete: boolean; // All phases complete
}

/**
 * Check if a frame has complete scene data (all phases done)
 *
 * @param frame - The frame to check
 * @returns True if frame has all required scene data
 */
export function isSceneComplete(frame: Frame): boolean {
  const scene = frame.metadata;

  if (!scene) {
    return false;
  }

  // Check all required fields for a complete scene
  const hasBasicScene = !!(
    scene.sceneId &&
    scene.sceneNumber &&
    scene.originalScript &&
    scene.metadata
  );

  const hasVisualPrompts = !!(
    scene.prompts?.visual?.fullPrompt &&
    scene.variants?.cameraAngles &&
    scene.variants?.moodTreatments &&
    scene.continuity
  );

  const hasMotionPrompts = !!(
    scene.prompts?.motion?.fullPrompt && scene.variants?.movementStyles
  );

  const hasAudioDesign = !!scene.audioDesign;

  return (
    hasBasicScene && hasVisualPrompts && hasMotionPrompts && hasAudioDesign
  );
}

/**
 * Get detailed completion status for a frame's scene data
 *
 * @param frame - The frame to check
 * @returns Completion status for each phase
 */
export function getSceneCompletionStatus(frame: Frame): SceneCompletionStatus {
  const scene = frame.metadata;

  if (!scene) {
    return {
      hasBasicScene: false,
      hasVisualPrompts: false,
      hasMotionPrompts: false,
      hasAudioDesign: false,
      isComplete: false,
    };
  }

  // Phase 1: Basic scene data
  const hasBasicScene = !!(
    scene.sceneId &&
    scene.sceneNumber &&
    scene.originalScript &&
    scene.metadata
  );

  // Phase 3: Visual prompts (also includes variants and continuity)
  const hasVisualPrompts = !!(
    scene.prompts?.visual?.fullPrompt &&
    scene.variants?.cameraAngles &&
    scene.variants?.moodTreatments &&
    scene.continuity
  );

  // Phase 4: Motion prompts (also includes movement variants)
  const hasMotionPrompts = !!(
    scene.prompts?.motion?.fullPrompt && scene.variants?.movementStyles
  );

  // Phase 5: Audio design
  const hasAudioDesign = !!scene.audioDesign;

  const isComplete =
    hasBasicScene && hasVisualPrompts && hasMotionPrompts && hasAudioDesign;

  return {
    hasBasicScene,
    hasVisualPrompts,
    hasMotionPrompts,
    hasAudioDesign,
    isComplete,
  };
}
