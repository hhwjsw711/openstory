/**
 * Lazy reconciliation for stale frame statuses.
 *
 * When frames are stuck in 'generating' for >5 minutes, we check QStash
 * to see if the workflow actually finished (success/fail/canceled).
 * If so, we update the DB to reflect reality.
 *
 * Called as fire-and-forget when frames are loaded — doesn't block responses.
 */

import { getDb } from '#db-client';
import { frames } from '@/lib/db/schema';
import type { Frame } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getWorkflowClient } from './client';
import type { WorkflowRunState } from './status';

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

type StatusField = 'thumbnailStatus' | 'videoStatus' | 'variantImageStatus';

const STATUS_TO_RUN_ID_FIELD: Record<StatusField, keyof Frame> = {
  thumbnailStatus: 'thumbnailWorkflowRunId',
  videoStatus: 'videoWorkflowRunId',
  variantImageStatus: 'variantWorkflowRunId',
};

/**
 * Check frames stuck in 'generating' for >5 minutes against QStash.
 * If the workflow is no longer running, mark the frame as 'failed'.
 */
export async function reconcileStaleFrameStatuses(
  frameList: Frame[]
): Promise<void> {
  const now = Date.now();

  // Collect all stale (frameId, statusField) pairs
  const staleEntries: Array<{ frame: Frame; field: StatusField }> = [];

  for (const frame of frameList) {
    const updatedAtMs = frame.updatedAt.getTime();
    if (now - updatedAtMs < STALE_THRESHOLD_MS) continue;

    const statusFields: StatusField[] = [
      'thumbnailStatus',
      'videoStatus',
      'variantImageStatus',
    ];
    for (const field of statusFields) {
      if (frame[field] === 'generating') {
        staleEntries.push({ frame, field });
      }
    }
  }

  // Fast path: nothing stale
  if (staleEntries.length === 0) return;

  const client = getWorkflowClient();
  const db = getDb();

  // Query QStash for each stale workflow and reconcile
  for (const { frame, field } of staleEntries) {
    const runIdField = STATUS_TO_RUN_ID_FIELD[field];
    const runId = String(frame[runIdField] ?? '');

    if (runId === '') {
      // No stored run ID — workflow was never tracked properly
      await markFrameStatus(db, frame.id, field, 'failed');
      continue;
    }

    try {
      const { runs } = await client.logs({ workflowRunId: runId, count: 1 });
      const run = runs[0];

      if (!run) {
        // No record in QStash — workflow never ran or was cleaned up
        await markFrameStatus(db, frame.id, field, 'failed');
        continue;
      }

      const state: WorkflowRunState = run.workflowState;

      if (state === 'RUN_FAILED' || state === 'RUN_CANCELED') {
        await markFrameStatus(db, frame.id, field, 'failed');
      } else if (state === 'RUN_SUCCESS') {
        await markFrameStatus(db, frame.id, field, 'completed');
      }
      // RUN_STARTED → still running, leave as 'generating'
    } catch (error) {
      // Don't let reconciliation errors propagate — this is best-effort
      console.error(
        `[reconcile] Failed to check workflow ${runId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}

async function markFrameStatus(
  db: ReturnType<typeof getDb>,
  frameId: string,
  field: StatusField,
  status: 'completed' | 'failed'
) {
  await db
    .update(frames)
    .set({ [field]: status, updatedAt: new Date() })
    .where(eq(frames.id, frameId));
}
