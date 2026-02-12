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
import { computeContentHash, computeInputHash } from './content-hash';
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
 */
export async function startWorkflow(
  workflowId: string,
  workflowType: string,
  inputEntityIds: string[]
): Promise<WorkflowStartResult> {
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

  const snapshotHash = await computeContentHash(entitySnapshots);

  // Content-addressable: reuse existing snapshot if same inputs
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
        snapshotData: entitySnapshots,
      })
      .returning();

    if (!newSnapshot) {
      throw new Error('Failed to create workflow snapshot');
    }
    snapshotId = newSnapshot.id;
  }

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
 * Compares original input hash (from snapshot) against current input hash.
 * If they differ, dependencies changed during the workflow — result is stale.
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

  const currentInputHash = await computeEntityInputHash(targetEntityId);

  // Compute original input hash using the same algorithm as computeEntityInputHash:
  // sorted concatenation of dependency content hashes → SHA-256
  const snapshotData = await getWorkflowSnapshot(workflowId);
  const originalInputHash = await computeInputHash(
    snapshotData.map((s) => s.contentHash)
  );

  await getDb()
    .update(dagWorkflows)
    .set({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- WorkflowStatus literal
      status: 'completed' as WorkflowStatus,
      completedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Workflow result stored as JSON
      result: result as Record<string, unknown>,
    })
    .where(eq(dagWorkflows.id, workflowId));

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
 */
export async function markWorkflowFailed(
  workflowId: string,
  error: string
): Promise<void> {
  await getDb()
    .update(dagWorkflows)
    .set({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- WorkflowStatus literal
      status: 'failed' as WorkflowStatus,
      completedAt: new Date(),
      error,
    })
    .where(eq(dagWorkflows.id, workflowId));
}
