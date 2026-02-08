/**
 * Collaborative Transaction Handler
 * Property-level last-writer-wins with transaction-based sync.
 * Handles optimistic concurrency: checks baseVersion matches current version
 * before applying updates, returns conflicts for client rebase.
 *
 * @module lib/services/dag/collaborative-transaction
 */

import { getEntity, updateEntity } from './versioned-entity-store';
import { onEntityUpdate } from './invalidation';

/**
 * A transaction represents a single property update from a client.
 */
export type Transaction = {
  type: 'update';
  entityId: string;
  baseVersion: number;
  property: string;
  oldValue: unknown;
  newValue: unknown;
  userId: string;
};

type TransactionResult =
  | {
      status: 'applied';
      newVersion: number;
      contentHash: string;
    }
  | {
      status: 'conflict';
      currentVersion: number;
      currentData: unknown;
      message: string;
    };

/**
 * Apply a collaborative edit transaction.
 *
 * 1. Check baseVersion matches current version
 * 2. If not, return conflict with current state for client to rebase
 * 3. If yes, apply update, increment version, compute new hash, trigger invalidation
 *
 * @param transaction - The edit transaction from a client
 * @returns Applied result or conflict response
 */
export async function applyTransaction(
  transaction: Transaction
): Promise<TransactionResult> {
  const current = await getEntity(transaction.entityId);

  if (!current) {
    throw new Error(`Entity ${transaction.entityId} not found`);
  }

  // Optimistic concurrency check
  if (current.version !== transaction.baseVersion) {
    return {
      status: 'conflict',
      currentVersion: current.version,
      currentData: current.data,
      message: `Version conflict: expected ${transaction.baseVersion}, current is ${current.version}`,
    };
  }

  // Apply the property-level update
  const currentData = current.data as Record<string, unknown>;
  const newData = {
    ...currentData,
    [transaction.property]: transaction.newValue,
  };

  // Create new version
  const updated = await updateEntity(
    transaction.entityId,
    newData,
    transaction.userId
  );

  // Trigger lazy invalidation
  await onEntityUpdate(
    transaction.entityId,
    updated.version,
    updated.contentHash
  );

  return {
    status: 'applied',
    newVersion: updated.version,
    contentHash: updated.contentHash,
  };
}

/**
 * Apply multiple transactions atomically.
 * All transactions must be for the same entity and same base version.
 * If any transaction conflicts, none are applied.
 *
 * @param transactions - Array of transactions to apply
 * @returns Applied result or conflict response
 */
export async function applyTransactionBatch(
  transactions: Transaction[]
): Promise<TransactionResult> {
  if (transactions.length === 0) {
    throw new Error('No transactions to apply');
  }

  const entityId = transactions[0].entityId;
  const baseVersion = transactions[0].baseVersion;

  // All transactions must target the same entity and version
  for (const tx of transactions) {
    if (tx.entityId !== entityId || tx.baseVersion !== baseVersion) {
      throw new Error(
        'Batch transactions must target the same entity and base version'
      );
    }
  }

  const current = await getEntity(entityId);
  if (!current) {
    throw new Error(`Entity ${entityId} not found`);
  }

  if (current.version !== baseVersion) {
    return {
      status: 'conflict',
      currentVersion: current.version,
      currentData: current.data,
      message: `Version conflict: expected ${baseVersion}, current is ${current.version}`,
    };
  }

  // Apply all property updates
  let newData = { ...(current.data as Record<string, unknown>) };
  for (const tx of transactions) {
    newData = { ...newData, [tx.property]: tx.newValue };
  }

  const updated = await updateEntity(entityId, newData, transactions[0].userId);

  await onEntityUpdate(entityId, updated.version, updated.contentHash);

  return {
    status: 'applied',
    newVersion: updated.version,
    contentHash: updated.contentHash,
  };
}
