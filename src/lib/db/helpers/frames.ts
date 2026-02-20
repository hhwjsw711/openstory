/**
 * Frame Operations Helpers
 * CRUD, ordering, and bulk operations using Drizzle ORM
 */

import { getDb } from '#db-client';
import type { Frame, NewFrame } from '@/lib/db/schema';
import { frames } from '@/lib/db/schema';
import type { Sequence } from '@/lib/db/schema/sequences';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

/**
 * Frame with its parent sequence
 */
type FrameWithSequence = Frame & {
  sequence: Pick<
    Sequence,
    | 'id'
    | 'teamId'
    | 'title'
    | 'status'
    | 'styleId'
    | 'videoModel'
    | 'aspectRatio'
  >;
};

/**
 * Frame ordering options
 */
type FrameOrderBy = 'orderIndex' | 'createdAt' | 'updatedAt';

/**
 * Frame filtering options
 */
type FrameFilters = {
  orderBy?: FrameOrderBy;
  ascending?: boolean;
  limit?: number;
  offset?: number;
  hasThumbnail?: boolean;
  hasVideo?: boolean;
};

// ============================================================================
// Core CRUD Operations
// ============================================================================

/**
 * Get a single frame by ID
 */
export async function getFrameById(frameId: string): Promise<Frame | null> {
  const result = await getDb()
    .select()
    .from(frames)
    .where(eq(frames.id, frameId));
  return result[0] ?? null;
}

/**
 * Get all frames for a sequence
 * Ordered by orderIndex by default
 */
export async function getSequenceFrames(
  sequenceId: string,
  options?: FrameFilters
): Promise<Frame[]> {
  const {
    orderBy = 'orderIndex',
    ascending = true,
    limit,
    offset,
    hasThumbnail,
    hasVideo,
  } = options ?? {};

  // Build where conditions
  const conditions = [eq(frames.sequenceId, sequenceId)];

  if (hasThumbnail !== undefined) {
    if (hasThumbnail) {
      conditions.push(isNull(frames.thumbnailUrl));
    }
  }

  if (hasVideo !== undefined) {
    if (hasVideo) {
      conditions.push(isNull(frames.videoUrl));
    }
  }

  // Build order clause
  const orderColumn =
    orderBy === 'orderIndex'
      ? frames.orderIndex
      : orderBy === 'createdAt'
        ? frames.createdAt
        : frames.updatedAt;

  const orderFn = ascending ? asc : desc;

  // Execute query
  let query = getDb()
    .select()
    .from(frames)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .$dynamic();

  if (limit) {
    query = query.limit(limit);
  }

  if (offset) {
    query = query.offset(offset);
  }

  return await query;
}

/**
 * Create a new frame
 */
export async function createFrame(data: NewFrame): Promise<Frame> {
  const [frame] = await getDb().insert(frames).values(data).returning();
  return frame;
}

/**
 * Update a frame
 *
 * @param options.throwOnMissing - If false, returns undefined instead of throwing when frame not found (default: true)
 */
export async function updateFrame(
  frameId: string,
  data: Partial<NewFrame>,
  options?: { throwOnMissing?: boolean }
): Promise<Frame | undefined> {
  const [frame] = await getDb()
    .update(frames)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(frames.id, frameId))
    .returning();

  if (!frame && options?.throwOnMissing !== false) {
    throw new Error(`Frame ${frameId} not found`);
  }

  return frame;
}

/**
 * Delete a single frame
 * @returns true if deleted, false if not found
 */
export async function deleteFrame(frameId: string): Promise<boolean> {
  const result = await getDb().delete(frames).where(eq(frames.id, frameId));
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Delete all frames in a sequence
 * @returns Number of frames deleted
 */
export async function deleteSequenceFrames(
  sequenceId: string
): Promise<number> {
  const result = await getDb()
    .delete(frames)
    .where(eq(frames.sequenceId, sequenceId));
  return result.rowsAffected ?? 0;
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Create multiple frames in a single insert
 */
export async function createFramesBulk(
  frameData: NewFrame[]
): Promise<Frame[]> {
  return await getDb().insert(frames).values(frameData).returning();
}

/**
 * Bulk insert frames with upsert on conflict (sequenceId + orderIndex)
 */
export async function bulkInsertFrames(
  frameInserts: NewFrame[]
): Promise<Frame[]> {
  return await getDb()
    .insert(frames)
    .values(frameInserts)
    .onConflictDoUpdate({
      target: [frames.sequenceId, frames.orderIndex],
      set: {
        description: sql.raw(`excluded."description"`),
        durationMs: sql.raw(`excluded."duration_ms"`),
        metadata: sql.raw(`excluded."metadata"`),
        updatedAt: new Date(),
      },
    })
    .returning();
}

/**
 * Reorder frames in a sequence
 * Uses batch to update all frames atomically (D1-compatible)
 */
export async function reorderFrames(
  _sequenceId: string,
  frameOrders: Array<{ id: string; order_index: number }>
): Promise<void> {
  if (frameOrders.length === 0) return;
  const db = getDb();
  const [first, ...rest] = frameOrders.map((frameOrder) =>
    db
      .update(frames)
      .set({ orderIndex: frameOrder.order_index, updatedAt: new Date() })
      .where(eq(frames.id, frameOrder.id))
  );
  await db.batch([first, ...rest]);
}

// ============================================================================
// Advanced Queries
// ============================================================================

/**
 * Get frames by their IDs
 */
export async function getFramesByIds(frameIds: string[]): Promise<Frame[]> {
  if (frameIds.length === 0) return [];
  return await getDb()
    .select()
    .from(frames)
    .where(inArray(frames.id, frameIds));
}

/**
 * Get frame with its parent sequence
 */
export async function getFrameWithSequence(
  frameId: string
): Promise<FrameWithSequence | null> {
  const result = await getDb().query.frames.findFirst({
    where: eq(frames.id, frameId),
    with: {
      sequence: {
        columns: {
          id: true,
          teamId: true,
          title: true,
          status: true,
          styleId: true,
          videoModel: true,
          aspectRatio: true,
        },
      },
    },
  });

  if (!result) {
    return null;
  }

  return result satisfies FrameWithSequence;
}
