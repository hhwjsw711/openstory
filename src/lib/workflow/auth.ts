/**
 * Authentication utilities for workflows
 */

import { AuthenticationError } from '@/lib/errors';
import type { UserWorkflowContext } from './types';

/**
 * Validates that workflow context includes required authentication
 * @throws AuthenticationError if userId or teamId is missing
 */
export function validateWorkflowAuth(
  context: unknown
): asserts context is UserWorkflowContext {
  const ctx = context as Partial<UserWorkflowContext>;

  if (!ctx.userId) {
    throw new AuthenticationError('Workflow context missing userId');
  }

  if (!ctx.teamId) {
    throw new AuthenticationError('Workflow context missing teamId');
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
