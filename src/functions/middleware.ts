/**
 * Server Function Middleware
 * Reusable middleware for authentication, team access, and resource validation
 */

import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import type Stripe from 'stripe';
import { getAuth } from '@/lib/auth/config';
import type { User, Session } from '@/lib/auth/config';
import {
  requireTeamMemberAccess,
  requireTeamAdminAccess,
  requireTeamOwnerAccess,
} from '@/lib/auth/action-utils';
import { requireSystemAdmin } from '@/lib/auth/system-admin';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import {
  createScopedDb,
  resolveUserTeam,
  type ScopedDb,
} from '@/lib/db/scoped';
import { isStripeEnabled } from '@/lib/billing/constants';
import { getStripeOrThrow, getStripeWebhookSecret } from '@/lib/billing/stripe';
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
  scopedDb: ScopedDb;
};

export type SystemAdminContext = TeamContext;

export type StripeWebhookContext = {
  stripeEvent: Stripe.Event | null;
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
// Logger Middleware
// ============================================================================

/**
 * Request logging middleware - logs server function name, duration, and outcome.
 * All other middleware chains from authMiddleware which chains from this,
 * so every server function gets logging automatically.
 */
export const loggerMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next, serverFnMeta }) => {
    const fnName = serverFnMeta.name;
    const start = performance.now();

    try {
      const result = await next();
      const ms = Math.round(performance.now() - start);
      console.info(`[ServerFn:${fnName}] OK ${ms}ms`);
      return result;
    } catch (error) {
      const ms = Math.round(performance.now() - start);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ServerFn:${fnName}] ERROR ${ms}ms "${message}"`);
      throw error;
    }
  }
);

// ============================================================================
// Auth Middleware
// ============================================================================

/**
 * Request auth middleware — for use with server routes (server.middleware).
 * Unlike authMiddleware (type: 'function'), this is request-scoped and
 * receives the request object directly from the middleware params.
 */
export const authRequestMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      throw new Response('Unauthorized', { status: 401 });
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
 * Stripe webhook signature verification middleware — for use with server routes.
 * Verifies the stripe-signature header and passes the validated event via context.
 * When Stripe is disabled, passes stripeEvent: null so the handler can early-return.
 */
export const stripeWebhookMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    if (!isStripeEnabled()) {
      return next({
        context: { stripeEvent: null as Stripe.Event | null },
      });
    }

    const stripe = getStripeOrThrow();
    const webhookSecret = getStripeWebhookSecret();
    if (!webhookSecret) {
      throw Response.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      throw Response.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    try {
      const event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
      return next({ context: { stripeEvent: event } });
    } catch {
      throw Response.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }
);

/**
 * Basic auth middleware - requires authenticated user
 * Adds user and session to context
 */
export const authMiddleware = createMiddleware({ type: 'function' })
  .middleware([loggerMiddleware])
  .server(async ({ next }) => {
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
  });

/**
 * Auth with default team context
 * Automatically resolves user's default team
 */
export const authWithTeamMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    const team = await resolveUserTeam(context.user.id);

    if (!team) {
      throw new Error('No team found for user');
    }

    return next({
      context: {
        teamId: team.teamId,
        scopedDb: createScopedDb(team.teamId, context.user.id),
      },
    });
  });

// ============================================================================
// System Admin Middleware
// ============================================================================

/**
 * System admin middleware - requires ADMIN_EMAILS env var match
 * Extends authWithTeamMiddleware so context includes teamId
 */
export const systemAdminMiddleware = createMiddleware({ type: 'function' })
  .middleware([authWithTeamMiddleware])
  .server(async ({ next, context }) => {
    requireSystemAdmin(context.user.email);
    return next();
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
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(z.looseObject({ sequenceId: ulidSchema })))
  .server(async ({ next, context, data }) => {
    const sequence = await context.scopedDb.sequences.getById(data.sequenceId);

    if (!sequence) {
      throw new Error('Sequence not found');
    }

    return next({
      context: {
        sequence,
      },
    });
  });

/**
 * Frame access middleware
 * Loads frame with its sequence and verifies team access
 * Requires sequenceId and frameId in input data
 */
export const frameAccessMiddleware = createMiddleware({ type: 'function' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(
    zodValidator(z.looseObject({ sequenceId: ulidSchema, frameId: ulidSchema }))
  )
  .server(async ({ next, context, data }) => {
    const frameData = await context.scopedDb.frames.getWithSequence(
      data.frameId
    );

    if (!frameData || frameData.sequenceId !== data.sequenceId) {
      throw new Error('Frame not found in this sequence');
    }

    if (frameData.sequence.teamId !== context.teamId) {
      throw new Error('Frame not found in this sequence');
    }

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
      },
    });
  });

/**
 * Team member access middleware
 * Verifies user has access to the specified team
 * Requires teamId in input data
 */
export const teamMemberAccessMiddleware = createMiddleware({ type: 'function' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(z.looseObject({ teamId: ulidSchema })))
  .server(async ({ next, context, data }) => {
    if (data.teamId !== context.teamId) {
      await requireTeamMemberAccess(context.user.id, data.teamId);
    }

    return next({
      context: {
        teamId: data.teamId,
        scopedDb:
          data.teamId === context.teamId
            ? context.scopedDb
            : createScopedDb(data.teamId, context.user.id),
      },
    });
  });

/**
 * Team admin access middleware
 * Verifies user has admin access to the specified team
 * Requires teamId in input data
 */
export const teamAdminAccessMiddleware = createMiddleware({ type: 'function' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(z.looseObject({ teamId: ulidSchema })))
  .server(async ({ next, context, data }) => {
    await requireTeamAdminAccess(context.user.id, data.teamId);

    return next({
      context: {
        teamId: data.teamId,
        scopedDb:
          data.teamId === context.teamId
            ? context.scopedDb
            : createScopedDb(data.teamId, context.user.id),
      },
    });
  });

/**
 * Team owner access middleware
 * Verifies user has owner access to the specified team
 * Requires teamId in input data
 */
export const teamOwnerAccessMiddleware = createMiddleware({ type: 'function' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(z.looseObject({ teamId: ulidSchema })))
  .server(async ({ next, context, data }) => {
    await requireTeamOwnerAccess(context.user.id, data.teamId);

    return next({
      context: {
        teamId: data.teamId,
        scopedDb:
          data.teamId === context.teamId
            ? context.scopedDb
            : createScopedDb(data.teamId, context.user.id),
      },
    });
  });
