/**
 * Credits and Transactions Schema
 * User credit balances and transaction history for billing
 */

import {
  desc,
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  real,
  index,
  check,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { user } from './auth';

// Enum values as constants (SQLite doesn't have native enums)
const TRANSACTION_TYPES = [
  'credit_purchase',
  'credit_usage',
  'credit_refund',
  'credit_adjustment',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/**
 * Credits table
 * Stores user credit balances
 */
export const credits = sqliteTable(
  'credits',
  {
    userId: text('user_id')
      .primaryKey()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Use real (float) for monetary values in SQLite
    balance: real().default(0.0).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Check constraint: balance must be non-negative
    check('positive_balance', sql`${table.balance} >= 0`),
  ]
);

/**
 * Transactions table
 * Credit transaction history for auditing and billing
 */
export const transactions = sqliteTable(
  'transactions',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text().$type<TransactionType>().notNull(),
    amount: real().notNull(),
    balanceAfter: real('balance_after').notNull(),
    metadata: text({ mode: 'json' }).$defaultFn(() => ({})),
    description: text(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_transactions_created_at').on(desc(table.createdAt)),
    index('idx_transactions_type').on(table.type),
    index('idx_transactions_user_id').on(table.userId),
  ]
);

// Relations
export const creditsRelations = relations(credits, ({ one }) => ({
  user: one(user, {
    fields: [credits.userId],
    references: [user.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(user, {
    fields: [transactions.userId],
    references: [user.id],
  }),
}));

// Type exports
export type Credit = InferSelectModel<typeof credits>;
export type NewCredit = InferInsertModel<typeof credits>;

export type Transaction = InferSelectModel<typeof transactions>;
export type NewTransaction = InferInsertModel<typeof transactions>;
