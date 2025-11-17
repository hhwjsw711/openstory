/**
 * Frame Operations Helpers
 * Comprehensive frame CRUD, ordering, and status operations using Drizzle ORM
 */

import { db } from '@/lib/db/client';
import type { Frame, NewFrame } from '@/lib/db/schema';
import { frames } from '@/lib/db/schema';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  sql,
} from 'drizzle-orm';

/**
 * Frame with its parent sequence
 */
export type FrameWithSequence = Frame & {
  sequence: {
    id: string;
    teamId: string;
    title: string;
    status: string;
    styleId: string | null;
  };
};

/**
 * Frame ordering options
 */
export type FrameOrderBy = 'orderIndex' | 'createdAt' | 'updatedAt';

/**
 * Frame filtering options
 */
export type FrameFilters = {
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
 *
 * @param frameId - The frame ID
 * @returns Frame or null if not found
 *
 * @example
 * ```ts
 * const frame = await getFrameById(frameId);
 * if (!frame) {
 *   return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
 * }
 * ```
 */
export async function getFrameById(frameId: string): Promise<Frame | null> {
  const result = await db.select().from(frames).where(eq(frames.id, frameId));
  return result[0] ?? null;
}

/**
 * Get all frames for a sequence
 * Ordered by orderIndex by default
 *
 * @param sequenceId - The sequence ID
 * @param options - Optional filtering and ordering
 * @returns Array of frames
 *
 * @example
 * ```ts
 * const frames = await getSequenceFrames(sequenceId);
 * const descFrames = await getSequenceFrames(sequenceId, { ascending: false });
 * const limitedFrames = await getSequenceFrames(sequenceId, { limit: 10 });
 * ```
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
  let query = db
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
 *
 * @param data - Frame data to insert
 * @returns Created frame
 *
 * @example
 * ```ts
 * const frame = await createFrame({
 *   sequenceId,
 *   orderIndex: 0,
 *   description: 'Opening shot',
 *   durationMs: 3000,
 * });
 * ```
 */
export async function createFrame(data: NewFrame): Promise<Frame> {
  const [frame] = await db.insert(frames).values(data).returning();
  return frame;
}

/**
 * Update a frame
 *
 * @param frameId - The frame ID
 * @param data - Frame data to update
 * @returns Updated frame
 *
 * @example
 * ```ts
 * const updated = await updateFrame(frameId, {
 *   description: 'Updated description',
 *   thumbnailUrl: 'https://...',
 * });
 * ```
 */
export async function updateFrame(
  frameId: string,
  data: Partial<NewFrame>
): Promise<Frame> {
  const [frame] = await db
    .update(frames)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(frames.id, frameId))
    .returning();

  if (!frame) {
    throw new Error(`Frame ${frameId} not found`);
  }

  return frame;
}

/**
 * Delete a single frame
 *
 * @param frameId - The frame ID
 * @returns true if deleted, false if not found
 *
 * @example
 * ```ts
 * const deleted = await deleteFrame(frameId);
 * if (!deleted) {
 *   return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
 * }
 * ```
 */
export async function deleteFrame(frameId: string): Promise<boolean> {
  const result = await db.delete(frames).where(eq(frames.id, frameId));
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Delete all frames in a sequence
 *
 * @param sequenceId - The sequence ID
 * @returns Number of frames deleted
 *
 * @example
 * ```ts
 * const count = await deleteSequenceFrames(sequenceId);
 * console.log(`Deleted ${count} frames`);
 * ```
 */
export async function deleteSequenceFrames(
  sequenceId: string
): Promise<number> {
  const result = await db
    .delete(frames)
    .where(eq(frames.sequenceId, sequenceId));
  return result.rowsAffected ?? 0;
}

// ============================================================================
// Frame Ordering Operations
// ============================================================================

/**
 * Reorder frames by providing array of frame IDs in desired order
 * Updates orderIndex for each frame based on position in array
 *
 * @param sequenceId - The sequence ID
 * @param frameIds - Array of frame IDs in desired order
 * @returns Array of updated frames
 *
 * @example
 * ```ts
 * // Reorder frames: move frame3 to first position
 * await reorderFrames(sequenceId, [frame3.id, frame1.id, frame2.id]);
 * ```
 */
export async function reorderFrames(
  sequenceId: string,
  frameIds: string[]
): Promise<Frame[]> {
  return await db.transaction(async (tx) => {
    const updatedFrames: Frame[] = [];

    for (let i = 0; i < frameIds.length; i++) {
      const [frame] = await tx
        .update(frames)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(
          and(eq(frames.id, frameIds[i]), eq(frames.sequenceId, sequenceId))
        )
        .returning();

      if (frame) {
        updatedFrames.push(frame);
      }
    }

    return updatedFrames;
  });
}

/**
 * Move a frame to a specific position
 * Adjusts orderIndex of other frames accordingly
 *
 * @param frameId - The frame ID to move
 * @param newOrderIndex - New position (0-based)
 * @returns Updated frame
 *
 * @example
 * ```ts
 * // Move frame to position 2 (third position)
 * await moveFrame(frameId, 2);
 * ```
 */
export async function moveFrame(
  frameId: string,
  newOrderIndex: number
): Promise<Frame> {
  return await db.transaction(async (tx) => {
    // Get the frame to move
    const [frameToMove] = await tx
      .select()
      .from(frames)
      .where(eq(frames.id, frameId));

    if (!frameToMove) {
      throw new Error(`Frame ${frameId} not found`);
    }

    const oldIndex = frameToMove.orderIndex;
    const sequenceId = frameToMove.sequenceId;

    // Note: We don't need to fetch all frames, we can just use SQL to shift them

    // If moving down, shift frames up
    if (newOrderIndex > oldIndex) {
      await tx
        .update(frames)
        .set({
          orderIndex: sql`${frames.orderIndex} - 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(frames.sequenceId, sequenceId),
            gt(frames.orderIndex, oldIndex),
            lte(frames.orderIndex, newOrderIndex)
          )
        );
    }
    // If moving up, shift frames down
    else if (newOrderIndex < oldIndex) {
      await tx
        .update(frames)
        .set({
          orderIndex: sql`${frames.orderIndex} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(frames.sequenceId, sequenceId),
            gte(frames.orderIndex, newOrderIndex),
            lt(frames.orderIndex, oldIndex)
          )
        );
    }

    // Move the frame to new position
    const [movedFrame] = await tx
      .update(frames)
      .set({ orderIndex: newOrderIndex, updatedAt: new Date() })
      .where(eq(frames.id, frameId))
      .returning();

    return movedFrame;
  });
}

/**
 * Swap positions of two frames
 *
 * @param frameId1 - First frame ID
 * @param frameId2 - Second frame ID
 * @returns Array with both updated frames
 *
 * @example
 * ```ts
 * const [frame1, frame2] = await swapFrames(frameId1, frameId2);
 * ```
 */
export async function swapFrames(
  frameId1: string,
  frameId2: string
): Promise<[Frame, Frame]> {
  return await db.transaction(async (tx) => {
    const [frame1] = await tx
      .select()
      .from(frames)
      .where(eq(frames.id, frameId1));

    const [frame2] = await tx
      .select()
      .from(frames)
      .where(eq(frames.id, frameId2));

    if (!frame1 || !frame2) {
      throw new Error('One or both frames not found');
    }

    // Swap order indices
    const [updatedFrame1] = await tx
      .update(frames)
      .set({ orderIndex: frame2.orderIndex, updatedAt: new Date() })
      .where(eq(frames.id, frameId1))
      .returning();

    const [updatedFrame2] = await tx
      .update(frames)
      .set({ orderIndex: frame1.orderIndex, updatedAt: new Date() })
      .where(eq(frames.id, frameId2))
      .returning();

    return [updatedFrame1, updatedFrame2];
  });
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Create multiple frames in a transaction
 *
 * @param frameData - Array of frame data to insert
 * @returns Array of created frames
 *
 * @example
 * ```ts
 * const frames = await createFramesBulk([
 *   { sequenceId, orderIndex: 0, description: 'Frame 1' },
 *   { sequenceId, orderIndex: 1, description: 'Frame 2' },
 * ]);
 * ```
 */
export async function createFramesBulk(
  frameData: NewFrame[]
): Promise<Frame[]> {
  return await db.transaction(async (tx) => {
    const createdFrames = await tx.insert(frames).values(frameData).returning();
    return createdFrames;
  });
}

/**
 * Update multiple frames in a transaction
 *
 * @param updates - Array of frame updates with IDs
 * @returns Array of updated frames
 *
 * @example
 * ```ts
 * const updated = await updateFramesBulk([
 *   { id: frame1.id, data: { description: 'Updated 1' } },
 *   { id: frame2.id, data: { thumbnailUrl: 'https://...' } },
 * ]);
 * ```
 */
export async function updateFramesBulk(
  updates: Array<{ id: string; data: Partial<NewFrame> }>
): Promise<Frame[]> {
  return await db.transaction(async (tx) => {
    const updatedFrames: Frame[] = [];

    for (const update of updates) {
      const [frame] = await tx
        .update(frames)
        .set({ ...update.data, updatedAt: new Date() })
        .where(eq(frames.id, update.id))
        .returning();

      if (frame) {
        updatedFrames.push(frame);
      }
    }

    return updatedFrames;
  });
}

/**
 * Delete multiple frames in a transaction
 *
 * @param frameIds - Array of frame IDs to delete
 * @returns Number of frames deleted
 *
 * @example
 * ```ts
 * const count = await deleteFramesBulk([frame1.id, frame2.id, frame3.id]);
 * console.log(`Deleted ${count} frames`);
 * ```
 */
export async function deleteFramesBulk(frameIds: string[]): Promise<number> {
  const result = await db.delete(frames).where(inArray(frames.id, frameIds));
  return result.rowsAffected ?? 0;
}

// ============================================================================
// Frame Status/Content Operations
// ============================================================================

/**
 * Update frame thumbnail URL
 *
 * @param frameId - The frame ID
 * @param thumbnailUrl - Thumbnail URL
 * @returns Updated frame
 *
 * @example
 * ```ts
 * const frame = await updateFrameThumbnail(frameId, 'https://storage.../thumb.jpg');
 * ```
 */
export async function updateFrameThumbnail(
  frameId: string,
  thumbnailUrl: string
): Promise<Frame> {
  return await updateFrame(frameId, { thumbnailUrl });
}

/**
 * Update frame video URL
 *
 * @param frameId - The frame ID
 * @param videoUrl - Video URL
 * @returns Updated frame
 *
 * @example
 * ```ts
 * const frame = await updateFrameVideo(frameId, 'https://storage.../video.mp4');
 * ```
 */
export async function updateFrameVideo(
  frameId: string,
  videoUrl: string
): Promise<Frame> {
  return await updateFrame(frameId, { videoUrl });
}

/**
 * Mark frame as completed by setting both thumbnail and video URLs
 *
 * @param frameId - The frame ID
 * @param thumbnailUrl - Thumbnail URL (optional if already set)
 * @param videoUrl - Video URL (optional if already set)
 * @returns Updated frame
 *
 * @example
 * ```ts
 * const frame = await markFrameComplete(frameId, thumbUrl, videoUrl);
 * ```
 */
export async function markFrameComplete(
  frameId: string,
  thumbnailUrl?: string,
  videoUrl?: string
): Promise<Frame> {
  const updates: Partial<NewFrame> = {};

  if (thumbnailUrl) {
    updates.thumbnailUrl = thumbnailUrl;
  }

  if (videoUrl) {
    updates.videoUrl = videoUrl;
  }

  return await updateFrame(frameId, updates);
}

/**
 * Get frames without thumbnails in a sequence
 *
 * @param sequenceId - The sequence ID
 * @returns Array of frames without thumbnails
 *
 * @example
 * ```ts
 * const framesToGenerate = await getFramesWithoutThumbnails(sequenceId);
 * console.log(`Need to generate ${framesToGenerate.length} thumbnails`);
 * ```
 */
export async function getFramesWithoutThumbnails(
  sequenceId: string
): Promise<Frame[]> {
  return await db
    .select()
    .from(frames)
    .where(and(eq(frames.sequenceId, sequenceId), isNull(frames.thumbnailUrl)))
    .orderBy(asc(frames.orderIndex));
}

/**
 * Get frames without video in a sequence
 *
 * @param sequenceId - The sequence ID
 * @returns Array of frames without video
 *
 * @example
 * ```ts
 * const framesToAnimate = await getFramesWithoutVideo(sequenceId);
 * console.log(`Need to generate ${framesToAnimate.length} videos`);
 * ```
 */
export async function getFramesWithoutVideo(
  sequenceId: string
): Promise<Frame[]> {
  return await db
    .select()
    .from(frames)
    .where(and(eq(frames.sequenceId, sequenceId), isNull(frames.videoUrl)))
    .orderBy(asc(frames.orderIndex));
}

// ============================================================================
// Advanced Queries
// ============================================================================

/**
 * Get frame with its parent sequence
 *
 * @param frameId - The frame ID
 * @returns Frame with sequence or null if not found
 *
 * @example
 * ```ts
 * const frameWithSeq = await getFrameWithSequence(frameId);
 * if (!frameWithSeq) {
 *   return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
 * }
 * console.log(`Frame belongs to sequence: ${frameWithSeq.sequence.title}`);
 * ```
 */
export async function getFrameWithSequence(
  frameId: string
): Promise<FrameWithSequence | null> {
  const result = await db.query.frames.findFirst({
    where: eq(frames.id, frameId),
    with: {
      sequence: {
        columns: {
          id: true,
          teamId: true,
          title: true,
          status: true,
          styleId: true,
        },
      },
    },
  });

  if (!result) {
    return null;
  }

  return result as FrameWithSequence;
}

/**
 * Count frames in a sequence
 *
 * @param sequenceId - The sequence ID
 * @returns Number of frames
 *
 * @example
 * ```ts
 * const count = await countSequenceFrames(sequenceId);
 * console.log(`Sequence has ${count} frames`);
 * ```
 */
export async function countSequenceFrames(sequenceId: string): Promise<number> {
  const [result] = await db
    .select({ count: db.$count(frames.id) })
    .from(frames)
    .where(eq(frames.sequenceId, sequenceId));

  return result?.count ?? 0;
}

/**
 * Get incomplete frames (missing thumbnail or video)
 *
 * @param sequenceId - The sequence ID
 * @returns Array of incomplete frames
 *
 * @example
 * ```ts
 * const incomplete = await getIncompleteFrames(sequenceId);
 * console.log(`${incomplete.length} frames need generation`);
 * ```
 */
export async function getIncompleteFrames(
  sequenceId: string
): Promise<Frame[]> {
  return await db
    .select()
    .from(frames)
    .where(
      and(
        eq(frames.sequenceId, sequenceId),
        sql`(${frames.thumbnailUrl} IS NULL OR ${frames.videoUrl} IS NULL)`
      )
    )
    .orderBy(asc(frames.orderIndex));
}
