/**
 * Sequence Service Layer
 *
 * Handles all sequence-related business logic including CRUD operations,
 * script analysis, and sequence management. This service contains pure
 * business logic with no authentication checks (caller's responsibility).
 *
 * @module lib/services/sequence.service
 */

import { eq, desc } from 'drizzle-orm';
import { ValidationError } from '@/lib/errors';
import { db } from '@/lib/db/client';
import { sequences } from '@/lib/db/schema';
import type { Sequence, NewSequence, SequenceStatus } from '@/lib/db/schema';

// Type definitions
export interface CreateSequenceParams {
  teamId: string;
  userId: string;
  name: string;
  script: string;
  styleId?: string;
  analysisModel?: string;
}

export interface UpdateSequenceParams {
  id: string;
  userId: string;
  name?: string;
  script?: string;
  styleId?: string | null;
  status?: SequenceStatus;
  metadata?: Record<string, unknown>;
  analysisModel?: string;
}

export interface SequenceWithDetails extends Sequence {
  frames?: Array<{
    id: string;
    orderIndex: number;
    description: string | null;
    thumbnailUrl: string | null;
    videoUrl: string | null;
  }>;
}

/**
 * Sequence Service Class
 *
 * Provides business logic for sequence operations. All methods assume
 * the caller has already verified authentication and authorization.
 */
export class SequenceService {
  /**
   * Create a new sequence
   *
   * @param params - Sequence creation parameters
   * @throws {Error} If database operation fails
   * @returns The created sequence
   */
  async createSequence(params: CreateSequenceParams): Promise<Sequence> {
    const sequenceData: NewSequence = {
      teamId: params.teamId,
      createdBy: params.userId,
      updatedBy: params.userId,
      title: params.name,
      script: params.script,
      styleId: params.styleId,
      analysisModel: params.analysisModel,
      status: 'draft',
    };

    const [data] = await db.insert(sequences).values(sequenceData).returning();

    if (!data) {
      throw new Error('No sequence returned from database');
    }

    return data;
  }

  /**
   * Update an existing sequence
   *
   * @param params - Sequence update parameters
   * @throws {ValidationError} If sequence not found
   * @throws {Error} If database operation fails
   * @returns The updated sequence
   */
  async updateSequence(params: UpdateSequenceParams): Promise<Sequence> {
    const updateData: Partial<NewSequence> = {
      ...(params.name !== undefined && { title: params.name }),
      ...(params.script !== undefined && { script: params.script }),
      ...(params.styleId !== undefined && { styleId: params.styleId }),
      ...(params.status !== undefined && { status: params.status }),
      ...(params.metadata !== undefined && { metadata: params.metadata }),
      ...(params.analysisModel !== undefined && {
        analysisModel: params.analysisModel,
      }),
      updatedBy: params.userId,
      updatedAt: new Date(),
    };

    const [data] = await db
      .update(sequences)
      .set(updateData)
      .where(eq(sequences.id, params.id))
      .returning();

    if (!data) {
      throw new ValidationError('Sequence not found');
    }

    return data;
  }

  /**
   * Delete a sequence
   *
   * @param sequenceId - The sequence ID to delete
   * @throws {Error} If database operation fails
   */
  async deleteSequence(sequenceId: string): Promise<void> {
    await db.delete(sequences).where(eq(sequences.id, sequenceId));
  }

  /**
   * Get a single sequence by ID
   *
   * @param sequenceId - The sequence ID
   * @param includeFrames - Whether to include frames in the response
   * @throws {ValidationError} If sequence not found
   * @throws {Error} If database operation fails
   * @returns The sequence
   */
  async getSequence(
    sequenceId: string,
    includeFrames = false
  ): Promise<SequenceWithDetails> {
    if (includeFrames) {
      const data = await db.query.sequences.findFirst({
        where: eq(sequences.id, sequenceId),
        with: {
          frames: {
            columns: {
              id: true,
              orderIndex: true,
              description: true,
              thumbnailUrl: true,
              videoUrl: true,
            },
            orderBy: (frames, { asc }) => [asc(frames.orderIndex)],
          },
        },
      });

      if (!data) {
        throw new ValidationError('Sequence not found');
      }

      return data as SequenceWithDetails;
    }

    const [data] = await db
      .select()
      .from(sequences)
      .where(eq(sequences.id, sequenceId));

    if (!data) {
      throw new ValidationError('Sequence not found');
    }

    return data;
  }

  /**
   * Get all sequences for a team
   *
   * @param teamId - The team ID
   * @throws {Error} If database operation fails
   * @returns Array of sequences
   */
  async getSequencesByTeam(teamId: string): Promise<Sequence[]> {
    return await db
      .select()
      .from(sequences)
      .where(eq(sequences.teamId, teamId))
      .orderBy(desc(sequences.updatedAt));
  }

  /**
   * Get all sequences created by a user
   *
   * @param userId - The user ID
   * @throws {Error} If database operation fails
   * @returns Array of sequences
   */
  async getSequencesByUser(userId: string): Promise<Sequence[]> {
    return await db
      .select()
      .from(sequences)
      .where(eq(sequences.createdBy, userId))
      .orderBy(desc(sequences.updatedAt));
  }

  /**
   * Update sequence status
   *
   * @param sequenceId - The sequence ID
   * @param status - The new status
   * @throws {Error} If database operation fails
   */
  async updateSequenceStatus(
    sequenceId: string,
    status: SequenceStatus
  ): Promise<void> {
    await db
      .update(sequences)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(sequences.id, sequenceId));
  }

  /**
   * Update sequence metadata
   *
   * @param sequenceId - The sequence ID
   * @param metadata - The metadata to merge
   * @throws {Error} If database operation fails
   */
  async updateSequenceMetadata(
    sequenceId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    // Get current metadata
    const [sequence] = await db
      .select({ metadata: sequences.metadata })
      .from(sequences)
      .where(eq(sequences.id, sequenceId));

    const currentMetadata =
      (sequence?.metadata as Record<string, unknown>) || {};

    await db
      .update(sequences)
      .set({
        metadata: {
          ...currentMetadata,
          ...metadata,
        },
        updatedAt: new Date(),
      })
      .where(eq(sequences.id, sequenceId));
  }

  /**
   * Duplicate a sequence
   *
   * @param sequenceId - The sequence ID to duplicate
   * @param userId - The user ID creating the duplicate
   * @param newName - Optional new name for the duplicate
   * @throws {ValidationError} If sequence not found
   * @throws {Error} If database operation fails
   * @returns The duplicated sequence
   */
  async duplicateSequence(
    sequenceId: string,
    userId: string,
    newName?: string
  ): Promise<Sequence> {
    // Get the original sequence
    const original = await this.getSequence(sequenceId);

    // Create a new sequence with the same data
    const duplicateData: NewSequence = {
      teamId: original.teamId,
      createdBy: userId,
      updatedBy: userId,
      title: newName || `${original.title} (Copy)`,
      script: original.script,
      styleId: original.styleId,
      analysisModel: original.analysisModel,
      status: 'draft',
      metadata: original.metadata,
    };

    const [data] = await db.insert(sequences).values(duplicateData).returning();

    if (!data) {
      throw new Error('No sequence returned from database');
    }

    return data;
  }
}

// Singleton instance
export const sequenceService = new SequenceService();
