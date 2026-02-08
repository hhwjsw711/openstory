/**
 * Generation Queue Service
 * Job queue for processing generation requests in dependency order.
 * Uses optimistic concurrency for job claiming since SQLite doesn't support SKIP LOCKED.
 *
 * @module lib/services/dag/generation-queue
 */

import { getDb } from '#db-client';
import { generationQueue } from '@/lib/db/schema/generation-queue';
import type { GenerationQueueJob } from '@/lib/db/schema/generation-queue';
import { and, asc, desc, eq } from 'drizzle-orm';
import { computeEntityInputHash } from './dependency-graph';
import { getRegenerationOrder } from './dependency-graph';

/**
 * Enqueue an entity for generation.
 * Computes the current input hash to detect if inputs change while queued.
 *
 * @param entityId - Entity to generate
 * @param priority - Higher priority jobs are claimed first (default: 0)
 * @returns The created queue job
 */
export async function enqueue(
  entityId: string,
  priority = 0
): Promise<GenerationQueueJob> {
  const inputHash = (await computeEntityInputHash(entityId)) ?? '';

  const [job] = await getDb()
    .insert(generationQueue)
    .values({
      entityId,
      priority,
      inputHash,
      status: 'pending',
    })
    .returning();

  if (!job) {
    throw new Error(`Failed to enqueue entity ${entityId}`);
  }

  return job;
}

/**
 * Batch enqueue multiple stale entities in topological order.
 * Entities are processed dependencies-first.
 *
 * @param entityIds - Array of entity IDs to enqueue
 * @param basePriority - Base priority level (default: 0)
 * @returns Array of created queue jobs
 */
export async function enqueueBatch(
  entityIds: string[],
  basePriority = 0
): Promise<GenerationQueueJob[]> {
  const ordered = await getRegenerationOrder(entityIds);
  const jobs: GenerationQueueJob[] = [];

  for (let i = 0; i < ordered.length; i++) {
    // Earlier items in topological order get higher priority
    const priority = basePriority + (ordered.length - i);
    const job = await enqueue(ordered[i], priority);
    jobs.push(job);
  }

  return jobs;
}

/**
 * Claim the next available pending job for processing.
 * Uses optimistic concurrency: attempts to update status from 'pending' to 'claimed'.
 * If the update affects 0 rows, another worker claimed it first — try the next one.
 *
 * Note: PostgreSQL migration would use `FOR UPDATE SKIP LOCKED` for better performance.
 *
 * @param workerId - Identifier of the claiming worker
 * @returns The claimed job, or null if no pending jobs
 */
export async function claimNext(
  workerId: string
): Promise<GenerationQueueJob | null> {
  // Get pending jobs ordered by priority (desc) then creation time (asc)
  const pendingJobs = await getDb()
    .select()
    .from(generationQueue)
    .where(eq(generationQueue.status, 'pending'))
    .orderBy(desc(generationQueue.priority), asc(generationQueue.createdAt))
    .limit(5); // Fetch a few in case of contention

  for (const job of pendingJobs) {
    // Optimistic concurrency: only update if still pending
    const result = await getDb()
      .update(generationQueue)
      .set({
        status: 'claimed',
        claimedBy: workerId,
        claimedAt: new Date(),
      })
      .where(
        and(
          eq(generationQueue.id, job.id),
          eq(generationQueue.status, 'pending')
        )
      )
      .returning();

    if (result.length > 0) {
      // Successfully claimed
      const claimed = result[0];

      // Verify input hash still matches — skip if inputs changed while queued
      const currentInputHash =
        (await computeEntityInputHash(claimed.entityId)) ?? '';
      if (currentInputHash !== claimed.inputHash && claimed.inputHash !== '') {
        // Inputs changed while queued — mark as skipped
        await getDb()
          .update(generationQueue)
          .set({ status: 'skipped' })
          .where(eq(generationQueue.id, claimed.id));
        continue;
      }

      return claimed;
    }
    // Another worker claimed it — try next
  }

  return null;
}

/**
 * Mark a job as completed.
 *
 * @param jobId - Job identifier
 */
export async function completeJob(jobId: string): Promise<void> {
  await getDb()
    .update(generationQueue)
    .set({ status: 'completed' })
    .where(eq(generationQueue.id, jobId));
}

/**
 * Mark a job as failed.
 *
 * @param jobId - Job identifier
 */
export async function failJob(jobId: string): Promise<void> {
  await getDb()
    .update(generationQueue)
    .set({ status: 'failed' })
    .where(eq(generationQueue.id, jobId));
}

/**
 * Get the current queue status for an entity.
 *
 * @param entityId - Entity to look up
 * @returns Latest queue job for the entity, or null
 */
export async function getQueueStatus(
  entityId: string
): Promise<GenerationQueueJob | null> {
  const jobs = await getDb()
    .select()
    .from(generationQueue)
    .where(eq(generationQueue.entityId, entityId))
    .orderBy(desc(generationQueue.createdAt))
    .limit(1);

  return jobs[0] ?? null;
}
