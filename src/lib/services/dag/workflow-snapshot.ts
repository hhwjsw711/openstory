/**
 * Workflow Snapshot Service
 * Captures immutable snapshots of input entities when workflows start.
 * The workflow reads from this snapshot, completely isolated from subsequent user edits.
 *
 * Content-addressable storage: identical snapshots share the same record (Git-inspired).
 *
 * @module lib/services/dag/workflow-snapshot
 */

import { getDb } from '#db-client';
import {
  workflowSnapshots,
  workflows as dagWorkflows,
} from '@/lib/db/schema/workflow-snapshots';
import type { WorkflowStatus } from '@/lib/db/schema/workflow-snapshots';
import { eq } from 'drizzle-orm';
import { computeContentHash } from './content-hash';
import { getEntity } from './versioned-entity-store';
import { computeEntityInputHash } from './dependency-graph';

type SnapshotEntityData = {
  entityId: string;
  version: number;
  contentHash: string;
  data: unknown;
};

type WorkflowStartResult = {
  workflowId: string;
  snapshotId: string;
  inputEntityRefs: Record<string, number>;
};

type WorkflowCompletionOutcome =
  | { status: 'applied'; message: string }
  | {
      status: 'stale';
      message: string;
      currentInputHash: string;
      originalInputHash: string;
    }
  | { status: 'error'; message: string };

/**
 * Start a workflow by capturing an immutable snapshot of all input entities.
 * Uses content-addressable deduplication — identical input sets reuse the same snapshot.
 *
 * @param workflowId - Unique workflow identifier
 * @param workflowType - Type of workflow (e.g., 'image', 'motion')
 * @param inputEntityIds - Array of entity IDs to snapshot
 * @returns Workflow start result with snapshot details
 */
export async function startWorkflow(
  workflowId: string,
  workflowType: string,
  inputEntityIds: string[]
): Promise<WorkflowStartResult> {
  // Capture current state of all input entities
  const entitySnapshots: SnapshotEntityData[] = [];
  const inputEntityRefs: Record<string, number> = {};

  for (const entityId of inputEntityIds) {
    const entity = await getEntity(entityId);
    if (!entity) {
      throw new Error(`Cannot start workflow: entity ${entityId} not found`);
    }
    entitySnapshots.push({
      entityId: entity.entityId,
      version: entity.version,
      contentHash: entity.contentHash,
      data: entity.data,
    });
    inputEntityRefs[entity.entityId] = entity.version;
  }

  // Content-addressable snapshot: same inputs = same snapshot
  const snapshotData = entitySnapshots;
  const snapshotHash = await computeContentHash(snapshotData);

  // Check if this exact snapshot already exists
  const existing = await getDb().query.workflowSnapshots.findFirst({
    where: eq(workflowSnapshots.contentHash, snapshotHash),
  });

  let snapshotId: string;

  if (existing) {
    snapshotId = existing.id;
  } else {
    const [newSnapshot] = await getDb()
      .insert(workflowSnapshots)
      .values({
        contentHash: snapshotHash,
        snapshotData,
      })
      .returning();

    if (!newSnapshot) {
      throw new Error('Failed to create workflow snapshot');
    }
    snapshotId = newSnapshot.id;
  }

  // Create workflow record
  await getDb().insert(dagWorkflows).values({
    id: workflowId,
    type: workflowType,
    status: 'running',
    snapshotId,
    inputEntityRefs,
    startedAt: new Date(),
  });

  return { workflowId, snapshotId, inputEntityRefs };
}

/**
 * Retrieve the frozen snapshot data for a running workflow.
 *
 * @param workflowId - Workflow identifier
 * @returns Snapshot entity data array
 */
export async function getWorkflowSnapshot(
  workflowId: string
): Promise<SnapshotEntityData[]> {
  const workflow = await getDb().query.dagWorkflows.findFirst({
    where: eq(dagWorkflows.id, workflowId),
  });

  if (!workflow?.snapshotId) {
    throw new Error(`Workflow ${workflowId} not found or has no snapshot`);
  }

  const snapshot = await getDb().query.workflowSnapshots.findFirst({
    where: eq(workflowSnapshots.id, workflow.snapshotId),
  });

  if (!snapshot) {
    throw new Error(`Snapshot ${workflow.snapshotId} not found`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Drizzle JSON column stores SnapshotEntityData[]
  return snapshot.snapshotData as SnapshotEntityData[];
}

/**
 * Handle workflow completion.
 * Compares input hash at completion time vs current input hash.
 *
 * Three outcomes:
 * 1. Hashes match → result is valid, apply it
 * 2. Hashes don't match → result is stale (dependencies changed during workflow)
 * 3. Error → workflow failed
 *
 * @param workflowId - Workflow identifier
 * @param result - Workflow result data
 * @param targetEntityId - The entity being generated
 * @returns Completion outcome
 */
export async function handleWorkflowComplete(
  workflowId: string,
  result: unknown,
  targetEntityId: string
): Promise<WorkflowCompletionOutcome> {
  const workflow = await getDb().query.dagWorkflows.findFirst({
    where: eq(dagWorkflows.id, workflowId),
  });

  if (!workflow) {
    return { status: 'error', message: `Workflow ${workflowId} not found` };
  }

  // Compute current input hash for the target entity
  const currentInputHash = await computeEntityInputHash(targetEntityId);

  // Get the snapshot to compute original input hash
  const snapshotData = await getWorkflowSnapshot(workflowId);
  const originalHashes = snapshotData
    .map((s) => s.contentHash)
    .sort()
    .join('');
  const originalInputHash = await computeContentHash(originalHashes);

  // Update workflow record
  await getDb()
    .update(dagWorkflows)
    .set({
      status: 'completed' as WorkflowStatus,
      completedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Workflow result stored as JSON
      result: result as Record<string, unknown>,
    })
    .where(eq(dagWorkflows.id, workflowId));

  // Compare hashes
  if (currentInputHash === null || currentInputHash === originalInputHash) {
    return {
      status: 'applied',
      message: 'Workflow result applied — inputs unchanged during generation',
    };
  }

  return {
    status: 'stale',
    message:
      'Dependencies changed during workflow execution — result may be outdated',
    currentInputHash,
    originalInputHash,
  };
}

/**
 * Mark a workflow as failed.
 *
 * @param workflowId - Workflow identifier
 * @param error - Error message
 */
export async function markWorkflowFailed(
  workflowId: string,
  error: string
): Promise<void> {
  await getDb()
    .update(dagWorkflows)
    .set({
      status: 'failed' as WorkflowStatus,
      completedAt: new Date(),
      error,
    })
    .where(eq(dagWorkflows.id, workflowId));
}
