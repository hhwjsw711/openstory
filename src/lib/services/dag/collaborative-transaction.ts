/**
 * Collaborative Transaction Handler
 * Property-level last-writer-wins with optimistic concurrency.
 * Checks baseVersion matches current version before applying updates.
 *
 * @module lib/services/dag/collaborative-transaction
 */

import { getEntity, updateEntity } from './versioned-entity-store';
import { onEntityUpdate } from './invalidation';

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
  | { status: 'applied'; newVersion: number; contentHash: string }
  | {
      status: 'conflict';
      currentVersion: number;
      currentData: unknown;
      message: string;
    };

/**
 * Apply one or more collaborative edit transactions.
 * All transactions must target the same entity and base version.
 */
export async function applyTransaction(
  ...transactions: Transaction[]
): Promise<TransactionResult> {
  if (transactions.length === 0) {
    throw new Error('No transactions to apply');
  }

  const { entityId, baseVersion, userId } = transactions[0];

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

  const newData = {
    ...(current.data as Record<string, unknown>),
    ...Object.fromEntries(transactions.map((tx) => [tx.property, tx.newValue])),
  };

  const updated = await updateEntity(entityId, newData, userId);
  await onEntityUpdate(entityId, updated.version, updated.contentHash);

  return {
    status: 'applied',
    newVersion: updated.version,
    contentHash: updated.contentHash,
  };
}

/**
 * Apply multiple transactions atomically (alias for variadic applyTransaction).
 */
export async function applyTransactionBatch(
  transactions: Transaction[]
): Promise<TransactionResult> {
  return applyTransaction(...transactions);
}
