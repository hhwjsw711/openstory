/**
 * Frame Service Layer
 *
 * Handles all frame-related business logic including CRUD operations,
 * frame generation orchestration, and reordering. This service contains
 * pure business logic with no authentication checks (caller's responsibility).
 *
 * @module lib/services/frame.service
 */

import { eq, and } from 'drizzle-orm';
import { ValidationError } from '@/lib/errors';
import { db } from '@/lib/db/client';
import { frames } from '@/lib/db/schema';
import type { Frame, NewFrame } from '@/lib/db/schema';
import {
  createFrame as createFrameHelper,
  updateFrame as updateFrameHelper,
  deleteFrame as deleteFrameHelper,
  deleteSequenceFrames,
  getSequenceFrames,
  createFramesBulk,
} from '@/lib/db/helpers/frames';

// Type definitions
export interface CreateFrameParams {
  sequenceId: string;
  description: string;
  orderIndex: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateFrameParams {
  id: string;
  description?: string;
  orderIndex?: number;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown> | null;
}

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
   * @param params - Frame creation parameters
   * @throws {Error} If database operation fails
   * @returns The created frame
   */
  async createFrame(params: CreateFrameParams): Promise<Frame> {
    const frameData: NewFrame = {
      sequenceId: params.sequenceId,
      description: params.description,
      orderIndex: params.orderIndex,
      thumbnailUrl: params.thumbnailUrl,
      videoUrl: params.videoUrl,
      durationMs: params.durationMs,
      metadata: params.metadata,
    };

    return await createFrameHelper(frameData);
  }

  /**
   * Update an existing frame
   *
   * @param params - Frame update parameters
   * @throws {ValidationError} If frame not found
   * @throws {Error} If database operation fails
   * @returns The updated frame
   */
  async updateFrame(params: UpdateFrameParams): Promise<Frame> {
    const updateData: Partial<NewFrame> = {
      ...(params.description !== undefined && {
        description: params.description,
      }),
      ...(params.orderIndex !== undefined && {
        orderIndex: params.orderIndex,
      }),
      ...(params.thumbnailUrl !== undefined && {
        thumbnailUrl: params.thumbnailUrl,
      }),
      ...(params.videoUrl !== undefined && { videoUrl: params.videoUrl }),
      ...(params.durationMs !== undefined && {
        durationMs: params.durationMs,
      }),
      ...(params.metadata !== undefined && { metadata: params.metadata }),
    };

    return await updateFrameHelper(params.id, updateData);
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
}

// Singleton instance
export const frameService = new FrameService();
