import { getDb } from '#db-client';
import { canAccessTeam } from '@/lib/db/helpers/team-permissions';
import {
  Sequence,
  SequenceMetadata,
  SequenceStatus,
} from '@/lib/db/schema/sequences';
import { AuthenticationError, ValidationError } from '@/lib/errors';
import { and, eq } from 'drizzle-orm';
import { sequences } from '../schema';

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
