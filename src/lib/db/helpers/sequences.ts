import { getDb } from '#db-client';
import { AnalysisModelId } from '@/lib/ai/models.config';
import {
  AspectRatio,
  DEFAULT_ASPECT_RATIO,
} from '@/lib/constants/aspect-ratios';
import { canAccessTeam } from '@/lib/db/helpers/team-permissions';
import {
  NewSequence,
  Sequence,
  SequenceMetadata,
  SequenceStatus,
} from '@/lib/db/schema/sequences';
import { AuthenticationError, ValidationError } from '@/lib/errors';
import { CreateSequenceInput } from '@/lib/schemas/sequence.schemas';
import { and, desc, eq } from 'drizzle-orm';
import { sequences } from '../schema';

// ============================================================================
// Types
// ============================================================================

export type CreateSequenceParams = Omit<
  Required<CreateSequenceInput>,
  'analysisModels' | 'analysisDurationMs' | 'metadata'
> & {
  analysisModel: AnalysisModelId;
  userId: string;
};

export type UpdateSequenceParams = {
  id: string;
  userId: string;
  title?: string;
  script?: string | null;
  styleId?: string;
  status?: SequenceStatus;
  metadata?: Record<string, unknown>;
  analysisModel?: string;
  aspectRatio?: AspectRatio;
  imageModel?: string;
  videoModel?: string;
};

export type SequenceWithDetails = Sequence & {
  frames?: Array<{
    id: string;
    orderIndex: number;
    description: string | null;
    thumbnailUrl: string | null;
    videoUrl: string | null;
  }>;
};

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new sequence
 */
export async function createSequence(
  params: CreateSequenceParams
): Promise<Sequence> {
  const sequenceData: NewSequence = {
    teamId: params.teamId,
    createdBy: params.userId,
    updatedBy: params.userId,
    title: params.title,
    script: params.script,
    styleId: params.styleId,
    aspectRatio: params.aspectRatio ?? DEFAULT_ASPECT_RATIO,
    analysisModel: params.analysisModel,
    imageModel: params.imageModel,
    videoModel: params.videoModel,
    status: 'draft',
  };

  const [data] = await getDb()
    .insert(sequences)
    .values(sequenceData)
    .returning();

  if (!data) {
    throw new Error('No sequence returned from database');
  }

  return data;
}

/**
 * Update an existing sequence
 */
export async function updateSequence(
  params: UpdateSequenceParams
): Promise<Sequence> {
  const updateData: Partial<NewSequence> = {
    title: params.title,
    script: params.script,
    styleId: params.styleId,
    status: params.status,
    metadata: params.metadata,
    analysisModel: params.analysisModel,
    imageModel: params.imageModel,
    videoModel: params.videoModel,
    updatedBy: params.userId,
    updatedAt: new Date(),
  };

  const [data] = await getDb()
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
 */
export async function deleteSequence(sequenceId: string): Promise<void> {
  await getDb().delete(sequences).where(eq(sequences.id, sequenceId));
}

/**
 * Get a single sequence by ID
 */
export async function getSequence(
  sequenceId: string,
  includeFrames = false
): Promise<SequenceWithDetails> {
  if (includeFrames) {
    const data = await getDb().query.sequences.findFirst({
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

  const [data] = await getDb()
    .select()
    .from(sequences)
    .where(eq(sequences.id, sequenceId));

  if (!data) {
    throw new ValidationError('Sequence not found');
  }

  return data;
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Get all sequences for a team
 *
 * @param teamId - The team ID
 * @throws {Error} If database operation fails
 * @returns Array of sequences
 */
export async function getSequencesByTeam(teamId: string): Promise<Sequence[]> {
  return await getDb()
    .select()
    .from(sequences)
    .where(eq(sequences.teamId, teamId))
    .orderBy(desc(sequences.updatedAt));
}

export async function getSequenceForUser({
  sequenceId,
  teamId,
  userId,
}: {
  sequenceId: string;
  teamId: string;
  userId: string;
}): Promise<Sequence> {
  const canAccess = await canAccessTeam(userId, teamId);
  if (!canAccess) {
    throw new AuthenticationError('User does not have access to this team');
  }
  const sequence = await getDb().query.sequences.findFirst({
    where: and(eq(sequences.id, sequenceId), eq(sequences.teamId, teamId)),
  });
  if (!sequence) {
    throw new ValidationError('Sequence not found');
  }
  return sequence;
}
/**
 * Update sequence metadata fields without losing existing data
 * Uses read-merge-update pattern for partial JSONB updates
 */
export async function updateSequenceMetadata(
  sequenceId: string,
  metadataUpdates: Partial<SequenceMetadata>,
  otherFields?: {
    status?: 'draft' | 'processing' | 'completed' | 'failed' | 'archived';
    [key: string]: unknown;
  }
) {
  // Read existing metadata
  const existing = await getDb().query.sequences.findFirst({
    where: eq(sequences.id, sequenceId),
    columns: { metadata: true },
  });

  const existingMetadata = existing?.metadata || {};

  // Merge metadata
  const updatedMetadata: SequenceMetadata = {
    ...existingMetadata,
    ...metadataUpdates,
  };

  // Update sequence
  await getDb()
    .update(sequences)
    .set({
      metadata: updatedMetadata,
      updatedAt: new Date(),
      ...otherFields,
    })
    .where(eq(sequences.id, sequenceId));
}

export async function updateSequenceStatus(
  sequenceId: string,
  status: SequenceStatus
) {
  await getDb()
    .update(sequences)
    .set({ status, updatedAt: new Date() })
    .where(eq(sequences.id, sequenceId));
}

export async function updateSequenceTitle(sequenceId: string, title: string) {
  await getDb()
    .update(sequences)
    .set({ title, updatedAt: new Date() })
    .where(eq(sequences.id, sequenceId));
}

export async function updateSequenceAnalysisDurationMs(
  sequenceId: string,
  durationMs: number
) {
  await getDb()
    .update(sequences)
    .set({ analysisDurationMs: durationMs, updatedAt: new Date() })
    .where(eq(sequences.id, sequenceId));
}

export async function updateSequenceWorkflow(
  sequenceId: string,
  workflow: string
) {
  await getDb()
    .update(sequences)
    .set({ workflow, updatedAt: new Date() })
    .where(eq(sequences.id, sequenceId));
}
