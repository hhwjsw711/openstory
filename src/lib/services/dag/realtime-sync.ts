/**
 * Realtime Sync Hub
 * Bridges Redis pub/sub events to WebSocket clients.
 *
 * Three Redis channels:
 * 1. entity:changed — property updates from versioned entity store
 * 2. entity:lifecycle — state machine transitions
 * 3. workflow:* — generation progress (ephemeral, not persisted to DB)
 *
 * @module lib/services/dag/realtime-sync
 */

import { getRedis } from '#redis';

type EntityChangedEvent = {
  entityId: string;
  version: number;
  contentHash: string;
  timestamp: number;
};

type LifecycleChangedEvent = {
  entityId: string;
  state: string;
  timestamp: number;
};

type WorkflowProgressEvent = {
  workflowId: string;
  entityId: string;
  progress: number;
  stage: string;
  timestamp: number;
};

type SyncEventHandler = {
  onEntityChanged?: (event: EntityChangedEvent) => void;
  onLifecycleChanged?: (event: LifecycleChangedEvent) => void;
  onWorkflowProgress?: (event: WorkflowProgressEvent) => void;
};

/**
 * Publish an entity change event to Redis.
 * Called by the versioned entity store after creating a new version.
 */
export async function publishEntityChanged(
  event: EntityChangedEvent
): Promise<void> {
  const redis = getRedis();
  await redis.publish('entity:changed', JSON.stringify(event));
}

/**
 * Publish a lifecycle state change to Redis.
 * Called by the entity lifecycle state machine on transitions.
 */
export async function publishLifecycleChanged(
  event: LifecycleChangedEvent
): Promise<void> {
  const redis = getRedis();
  await redis.publish('entity:lifecycle', JSON.stringify(event));
}

/**
 * Publish workflow progress (ephemeral — not persisted to DB).
 * Used for real-time generation progress bars in the UI.
 */
export async function publishWorkflowProgress(
  event: WorkflowProgressEvent
): Promise<void> {
  const redis = getRedis();

  // Store progress in a hash for quick reads
  await redis.hset(`workflow:${event.workflowId}:progress`, {
    entityId: event.entityId,
    progress: event.progress.toString(),
    stage: event.stage,
    timestamp: event.timestamp.toString(),
  });

  // Also publish for real-time subscribers
  await redis.publish(`workflow:${event.workflowId}`, JSON.stringify(event));
}

/**
 * Get current workflow progress from Redis.
 *
 * @param workflowId - Workflow identifier
 * @returns Progress data or null
 */
export async function getWorkflowProgress(
  workflowId: string
): Promise<WorkflowProgressEvent | null> {
  const redis = getRedis();
  const data = await redis.hgetall(`workflow:${workflowId}:progress`);

  if (!data || Object.keys(data).length === 0) return null;

  return {
    workflowId,
    entityId: String(data.entityId ?? ''),
    progress: Number(data.progress),
    stage: String(data.stage ?? ''),
    timestamp: Number(data.timestamp),
  };
}

/**
 * Clean up workflow progress data from Redis after completion.
 *
 * @param workflowId - Workflow identifier
 */
export async function cleanupWorkflowProgress(
  workflowId: string
): Promise<void> {
  const redis = getRedis();
  await redis.del(`workflow:${workflowId}:progress`);
}

/**
 * RealtimeSyncHub class for managing subscriptions.
 * In a WebSocket server context, this would handle client connections
 * and relay Redis pub/sub events to connected clients.
 */
export class RealtimeSyncHub {
  private handlers: SyncEventHandler[] = [];

  /**
   * Register event handlers for real-time events.
   */
  addHandler(handler: SyncEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /**
   * Process an incoming entity changed message from Redis.
   */
  handleEntityChanged(message: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Redis pub/sub messages are trusted internal events
    const event = JSON.parse(message) as EntityChangedEvent;
    for (const handler of this.handlers) {
      handler.onEntityChanged?.(event);
    }
  }

  /**
   * Process an incoming lifecycle changed message from Redis.
   */
  handleLifecycleChanged(message: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Redis pub/sub messages are trusted internal events
    const event = JSON.parse(message) as LifecycleChangedEvent;
    for (const handler of this.handlers) {
      handler.onLifecycleChanged?.(event);
    }
  }

  /**
   * Process an incoming workflow progress message from Redis.
   */
  handleWorkflowProgress(message: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Redis pub/sub messages are trusted internal events
    const event = JSON.parse(message) as WorkflowProgressEvent;
    for (const handler of this.handlers) {
      handler.onWorkflowProgress?.(event);
    }
  }

  /**
   * Convenience: check if any handlers are registered.
   */
  get hasHandlers(): boolean {
    return this.handlers.length > 0;
  }
}

/** Singleton hub instance */
let _hub: RealtimeSyncHub | null = null;

export function getRealtimeSyncHub(): RealtimeSyncHub {
  if (!_hub) {
    _hub = new RealtimeSyncHub();
  }
  return _hub;
}
