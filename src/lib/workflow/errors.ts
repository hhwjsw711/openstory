import { WorkflowError, WorkflowNonRetryableError } from '@upstash/workflow';

/**
 * Non-retryable error for validation failures.
 * Used when input is invalid, missing required fields, or fails validation rules.
 * QStash will NOT retry when this error is thrown.
 *
 * @example
 * throw new WorkflowValidationError('Script is too short (minimum 50 characters)');
 */
export class WorkflowValidationError extends WorkflowNonRetryableError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}

/**
 * Non-retryable error for authorization failures.
 * Used when user/team is not authorized to perform the operation.
 * QStash will NOT retry when this error is thrown.
 *
 * @example
 * throw new WorkflowAuthError('Missing user or team context');
 */
export class WorkflowAuthError extends WorkflowNonRetryableError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowAuthError';
  }
}

/**
 * Retryable error for transient failures.
 * Used for network errors, AI service timeouts, rate limits, etc.
 * QStash will retry according to the workflow's retry configuration.
 *
 * @example
 * throw new WorkflowTransientError('AI service timeout - will retry');
 */
export class WorkflowTransientError extends WorkflowError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowTransientError';
  }
}

/**
 * Helper function to detect if an error is from an invalid or too-short script.
 * Checks common patterns in AI responses that indicate script validation failure.
 *
 * @param error - Error message or analysis result to check
 * @returns true if error indicates invalid script
 */
export function isInvalidScriptError(error: unknown): boolean {
  if (!error) return false;

  const message =
    typeof error === 'string'
      ? error.toLowerCase()
      : error instanceof Error
        ? error.message.toLowerCase()
        : JSON.stringify(error).toLowerCase();

  const invalidPatterns = [
    'too short',
    'not a script',
    'invalid script',
    'invalid format',
    'no scenes',
    'not enough content',
    'minimum length',
    'insufficient content',
  ];

  return invalidPatterns.some((pattern) => message.includes(pattern));
}

/**
 * Helper function to detect if an error is transient (network, timeout, rate limit).
 *
 * @param error - Error to check
 * @returns true if error is likely transient and should be retried
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const transientPatterns = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'timeout',
    'network',
    'rate limit',
    'too many requests',
    '429',
    '500',
    '502',
    '503',
    '504',
  ];

  const message = error.message.toLowerCase();
  return transientPatterns.some((pattern) =>
    message.includes(pattern.toLowerCase())
  );
}
