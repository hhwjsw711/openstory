import { SequenceMetadata } from '@/lib/db/schema/sequences';
import { eq } from 'drizzle-orm';
import { db } from '../client';
import { sequences } from '../schema';

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
  const existing = await db.query.sequences.findFirst({
    where: eq(sequences.id, sequenceId),
    columns: { metadata: true },
  });

  const existingMetadata = existing?.metadata || {};

  // Merge metadata deeply
  const updatedMetadata: SequenceMetadata = {
    ...existingMetadata,
    ...metadataUpdates,
  };

  // Merge frameGeneration if provided
  if (metadataUpdates.frameGeneration) {
    updatedMetadata.frameGeneration = {
      ...existingMetadata.frameGeneration,
      ...metadataUpdates.frameGeneration,
    };
  }

  // Update sequence
  await db
    .update(sequences)
    .set({
      metadata: updatedMetadata,
      updatedAt: new Date(),
      ...otherFields,
    })
    .where(eq(sequences.id, sequenceId));
}
