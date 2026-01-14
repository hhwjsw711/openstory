/**
 * Server Function Middleware
 * Reusable middleware for authentication, team access, and resource validation
 */

import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { getAuth } from '@/lib/auth/config';
import type { User, Session } from '@/lib/auth/config';
import { getUserDefaultTeam } from '@/lib/db/helpers/team-permissions';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { getFrameWithSequence } from '@/lib/db/helpers/frames';
import {
  requireTeamMemberAccess,
  requireTeamAdminAccess,
  requireTeamOwnerAccess,
} from '@/lib/auth/action-utils';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import type { Sequence, Frame } from '@/types/database';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';

// ============================================================================
// Context Types
// ============================================================================

export type AuthContext = {
  user: User;
  session: Session;
};

export type TeamContext = AuthContext & {
  teamId: string;
};

export type SequenceContext = TeamContext & {
  sequence: Sequence;
};

/**
 * Partial sequence type returned by getFrameWithSequence
 * Contains only the fields selected by the query
 */
type PartialSequence = {
  id: string;
  teamId: string;
  title: string;
  status: string;
  styleId: string | null;
  videoModel: string;
  aspectRatio: AspectRatio;
};

export type FrameContext = TeamContext & {
  frame: Omit<Frame, 'sequence'>;
  sequence: PartialSequence;
};

// ============================================================================
// Auth Middleware
// ============================================================================

/**
 * Basic auth middleware - requires authenticated user
 * Adds user and session to context
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest();
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      throw new Error('Authentication required');
    }

    return next({
      context: {
        user: session.user,
        session,
      },
    });
  }
);

/**
 * Auth with default team context
 * Automatically resolves user's default team
 */
export const authWithTeamMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    const team = await getUserDefaultTeam(context.user.id);

    if (!team) {
      throw new Error('No team found for user');
    }

    return next({
      context: {
        teamId: team.teamId,
      },
    });
  });

// ============================================================================
// Resource Access Middleware
// ============================================================================

/**
 * Sequence access middleware
 * Loads sequence and verifies team access
 * Requires sequenceId in input data
 */
export const sequenceAccessMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(z.looseObject({ sequenceId: ulidSchema })))
  .server(async ({ next, context, data }) => {
    const sequence = await getSequenceById(data.sequenceId);

    if (!sequence) {
      throw new Error('Sequence not found');
    }

    await requireTeamMemberAccess(context.user.id, sequence.teamId);

    return next({
      context: {
        sequence,
        teamId: sequence.teamId,
      },
    });
  });

/**
 * Frame access middleware
 * Loads frame with its sequence and verifies team access
 * Requires sequenceId and frameId in input data
 */
export const frameAccessMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .inputValidator(
    zodValidator(z.looseObject({ sequenceId: ulidSchema, frameId: ulidSchema }))
  )
  .server(async ({ next, context, data }) => {
    const frameData = await getFrameWithSequence(data.frameId);

    if (!frameData || frameData.sequenceId !== data.sequenceId) {
      throw new Error('Frame not found in this sequence');
    }

    await requireTeamMemberAccess(context.user.id, frameData.sequence.teamId);

    // Extract sequence from frame data (using the partial sequence from the query)
    const { sequence: rawSequence, ...frame } = frameData;

    // Type assertion needed because Drizzle's nested relation inference loses the $type<AspectRatio>() annotation
    const sequence: PartialSequence = {
      ...rawSequence,
      aspectRatio: rawSequence.aspectRatio satisfies AspectRatio,
    };

    return next({
      context: {
        frame,
        sequence,
        teamId: sequence.teamId,
      },
    });
  });

/**
 * Team member access middleware
 * Verifies user has access to the specified team
 * Requires teamId in input data
 */
export const teamMemberAccessMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(z.looseObject({ teamId: ulidSchema })))
  .server(async ({ next, context, data }) => {
    await requireTeamMemberAccess(context.user.id, data.teamId);

    return next({
      context: {
        teamId: data.teamId,
      },
    });
  });

/**
 * Team admin access middleware
 * Verifies user has admin access to the specified team
 * Requires teamId in input data
 */
export const teamAdminAccessMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(z.looseObject({ teamId: ulidSchema })))
  .server(async ({ next, context, data }) => {
    await requireTeamAdminAccess(context.user.id, data.teamId);

    return next({
      context: {
        teamId: data.teamId,
      },
    });
  });

/**
 * Team owner access middleware
 * Verifies user has owner access to the specified team
 * Requires teamId in input data
 */
export const teamOwnerAccessMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(z.looseObject({ teamId: ulidSchema })))
  .server(async ({ next, context, data }) => {
    await requireTeamOwnerAccess(context.user.id, data.teamId);

    return next({
      context: {
        teamId: data.teamId,
      },
    });
  });
