import { getDb } from '#db-client';
import {
  type AspectRatio,
  DEFAULT_ASPECT_RATIO,
} from '@/lib/constants/aspect-ratios';
import { canAccessTeam } from '@/lib/db/helpers/team-permissions';
import {
  type NewSequence,
  type Sequence,
  type SequenceStatus,
} from '@/lib/db/schema/sequences';
import { AuthenticationError, ValidationError } from '@/lib/errors';
import { and, desc, eq, not } from 'drizzle-orm';
import { sequences } from '../schema';

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new sequence
 */
export async function createSequence(params: {
  teamId: string;
  userId: string;
  title: string;
  script?: string | null;
  styleId: string;
  aspectRatio?: AspectRatio;
  analysisModel: string;
  imageModel?: string;
  videoModel?: string;
}): Promise<Sequence> {
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
export async function updateSequence(params: {
  id: string;
  userId: string;
  title?: string;
  script?: string | null;
  styleId?: string;
  status?: SequenceStatus;
  analysisModel?: string;
  aspectRatio?: AspectRatio;
  imageModel?: string;
  videoModel?: string;
}): Promise<Sequence> {
  const updateData: Partial<NewSequence> = {
    title: params.title,
    script: params.script,
    styleId: params.styleId,
    status: params.status,
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
    .where(
      and(eq(sequences.teamId, teamId), not(eq(sequences.status, 'archived')))
    )
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

export async function updateSequenceStatus(
  sequenceId: string,
  status: SequenceStatus,
  error?: string | null
) {
  await getDb()
    .update(sequences)
    .set({ status, statusError: error ?? null, updatedAt: new Date() })
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

export async function updateSequenceMusicPrompt(
  sequenceId: string,
  musicPrompt: string,
  musicTags: string
) {
  await getDb()
    .update(sequences)
    .set({ musicPrompt, musicTags, updatedAt: new Date() })
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
