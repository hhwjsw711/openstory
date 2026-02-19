/**
 * Workflow Status Server Functions
 * Live lookup of workflow statuses from QStash (not DB).
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authMiddleware } from './middleware';
import { createMiddleware } from '@tanstack/react-start';
import {
  getActiveWorkflowsForFrames,
  type FrameWorkflowStatuses,
} from '@/lib/workflow/status';

/** Middleware that validates frameIds input and requires auth */
const workflowStatusMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .inputValidator(
    zodValidator(
      z.looseObject({
        frameIds: z.array(z.string()).max(100),
      })
    )
  )
  .server(async ({ next, data }) => {
    return next({ context: { frameIds: data.frameIds } });
  });

/**
 * Get active workflow statuses for a set of frames.
 * Queries QStash directly — no DB involved.
 *
 * Returns only frames that have at least one active workflow.
 */
export const getWorkflowStatusesFn = createServerFn({ method: 'GET' })
  .middleware([workflowStatusMiddleware])
  .handler(
    async ({ context }): Promise<Record<string, FrameWorkflowStatuses>> => {
      return getActiveWorkflowsForFrames(context.frameIds);
    }
  );
