/**
 * Transaction Utilities
 * Helpers for working with database transactions in Drizzle ORM
 */

import { db, type Database } from '@/lib/db/client';

/**
 * Transaction callback type
 * The transaction object has the same API as the main db instance
 */
export type TransactionCallback<T> = (
  tx: Parameters<Parameters<Database['transaction']>[0]>[0]
) => Promise<T>;

/**
 * Execute a callback within a database transaction
 * Automatically commits on success or rolls back on error
 *
 * @param callback - Function to execute within the transaction
 * @returns The result from the callback
 * @throws Error if the transaction fails
 *
 * @example
 * ```ts
 * const result = await withTransaction(async (tx) => {
 *   const sequence = await tx.insert(sequences).values(...).returning();
 *   const frames = await tx.insert(frames).values(...).returning();
 *   return { sequence, frames };
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: TransactionCallback<T>
): Promise<T> {
  return await db.transaction(callback);
}

/**
 * Execute multiple operations in a transaction with rollback on any error
 * Useful for batch operations where all must succeed or all must fail
 *
 * @param operations - Array of async functions to execute in order
 * @returns Array of results from each operation
 * @throws Error if any operation fails (all previous operations are rolled back)
 *
 * @example
 * ```ts
 * const [sequence, style, frames] = await withBatchTransaction([
 *   (tx) => tx.insert(sequences).values(seqData).returning(),
 *   (tx) => tx.insert(styles).values(styleData).returning(),
 *   (tx) => tx.insert(frames).values(framesData).returning(),
 * ]);
 * ```
 */
export async function withBatchTransaction<T extends unknown[]>(operations: {
  [K in keyof T]: TransactionCallback<T[K]>;
}): Promise<T> {
  return await db.transaction(async (tx) => {
    const results: unknown[] = [];
    for (const operation of operations) {
      const result = await operation(tx);
      results.push(result);
    }
    return results as T;
  });
}

/**
 * Retry a transaction up to a specified number of times
 * Useful for handling serialization errors or temporary conflicts
 *
 * @param callback - Function to execute within the transaction
 * @param options - Retry options
 * @returns The result from the callback
 * @throws Error if all retries fail
 *
 * @example
 * ```ts
 * const result = await withRetryTransaction(
 *   async (tx) => {
 *     // Some operation that might have serialization conflicts
 *     return await tx.update(sequences).set({ status: 'processing' });
 *   },
 *   { maxRetries: 3, delayMs: 100 }
 * );
 * ```
 */
export async function withRetryTransaction<T>(
  callback: TransactionCallback<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 100,
    shouldRetry = (error: Error) => {
      // Retry on serialization failures and deadlocks
      const message = error.message.toLowerCase();
      return (
        message.includes('serialization') ||
        message.includes('deadlock') ||
        message.includes('could not serialize')
      );
    },
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await db.transaction(callback);
    } catch (error) {
      lastError = error as Error;

      // Don't retry if this is the last attempt or if we shouldn't retry this error
      if (attempt === maxRetries - 1 || !shouldRetry(lastError)) {
        break;
      }

      // Wait before retrying (exponential backoff)
      const delay = delayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Transaction failed after retries');
}

/**
 * Transaction isolation level options
 */
export type IsolationLevel =
  | 'read uncommitted'
  | 'read committed'
  | 'repeatable read'
  | 'serializable';

/**
 * Execute a transaction with a specific isolation level
 * PostgreSQL default is 'read committed'
 *
 * @param callback - Function to execute within the transaction
 * @param isolationLevel - The isolation level to use
 * @returns The result from the callback
 * @throws Error if the transaction fails
 *
 * @example
 * ```ts
 * const result = await withIsolationLevel(
 *   async (tx) => {
 *     // Critical operation requiring serializable isolation
 *     return await tx.insert(sequences).values(...).returning();
 *   },
 *   'serializable'
 * );
 * ```
 */
export async function withIsolationLevel<T>(
  callback: TransactionCallback<T>,
  isolationLevel: IsolationLevel
): Promise<T> {
  return await db.transaction(callback, {
    isolationLevel,
  });
}

/**
 * Create a savepoint within a transaction
 * Useful for partial rollbacks within a larger transaction
 *
 * Note: This is a lower-level utility. Most use cases are better served
 * by nested transactions or multiple separate transactions.
 *
 * @param tx - The transaction object
 * @param name - Savepoint name
 * @param callback - Function to execute after creating the savepoint
 * @returns The result from the callback
 *
 * @example
 * ```ts
 * await withTransaction(async (tx) => {
 *   await tx.insert(sequences).values(seqData);
 *
 *   try {
 *     await withSavepoint(tx, 'frames_insert', async () => {
 *       await tx.insert(frames).values(framesData);
 *     });
 *   } catch (error) {
 *     // Frame insert failed, but sequence insert is preserved
 *     console.error('Failed to insert frames:', error);
 *   }
 * });
 * ```
 */
export async function withSavepoint<T>(
  tx: Parameters<TransactionCallback<unknown>>[0],
  name: string,
  callback: () => Promise<T>
): Promise<T> {
  // Create savepoint
  await tx.execute(`SAVEPOINT ${name}`);

  try {
    const result = await callback();
    // Release savepoint on success
    await tx.execute(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (error) {
    // Rollback to savepoint on error
    await tx.execute(`ROLLBACK TO SAVEPOINT ${name}`);
    throw error;
  }
}
