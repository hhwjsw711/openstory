/**
 * Authentication utilities for workflows
 */

import { AuthenticationError } from '@/lib/errors';
import type { SequenceWorkflowContext, UserWorkflowContext } from './types';

/**
 * Validates that workflow context includes required authentication
 * @throws AuthenticationError if userId or teamId is missing
 */
export function validateWorkflowAuth(
  context: unknown
): asserts context is UserWorkflowContext {
  const ctx = context as Partial<UserWorkflowContext>;

  // A sequence Id has been provided, so we need to check the user is part of the team and the sequence belongs to the team.
  if (!ctx.userId) {
    throw new AuthenticationError('Workflow context missing userId');
  }

  if (!ctx.teamId) {
    throw new AuthenticationError('Workflow context missing teamId');
  }
}

export function validateSequenceAuth(
  context: unknown
): asserts context is SequenceWorkflowContext {
  validateWorkflowAuth(context);
  const ctx = context as Partial<SequenceWorkflowContext>;
  if (!ctx.sequenceId) {
    throw new AuthenticationError('Sequence context missing sequenceId');
  }
}
/**
 * Extracts auth context from workflow input
 * Validates and returns a WorkflowContext object
 */
export function getWorkflowAuth(input: unknown): UserWorkflowContext {
  validateWorkflowAuth(input);
  return {
    userId: input.userId,
    teamId: input.teamId,
  };
}

/**
 * Checks if a workflow context has valid authentication
 * Non-throwing version of validateWorkflowAuth
 */
export function hasWorkflowAuth(
  context: unknown
): context is UserWorkflowContext {
  const ctx = context as Partial<UserWorkflowContext>;
  return Boolean(ctx.userId && ctx.teamId);
}

/**
 * Checks if a workflow context has valid authentication
 * Non-throwing version of validateWorkflowAuth
 */
export function hasSequenceAuth(
  context: unknown
): context is SequenceWorkflowContext {
  const ctx = context as Partial<SequenceWorkflowContext>;
  return Boolean(ctx.sequenceId && ctx.teamId && ctx.userId);
}
