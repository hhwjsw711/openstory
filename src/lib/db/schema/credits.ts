/**
 * Credits and Transactions Schema
 * User credit balances and transaction history for billing
 */

import {
  pgTable,
  uuid,
  decimal,
  timestamp,
  text,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import {
  relations,
  InferSelectModel,
  InferInsertModel,
  sql,
} from 'drizzle-orm';
import { user } from './auth';

// Enums
export const transactionTypeEnum = [
  'credit_purchase',
  'credit_usage',
  'credit_refund',
  'credit_adjustment',
] as const;
export type TransactionType = (typeof transactionTypeEnum)[number];

/**
 * Credits table
 * Stores user credit balances
 */
export const credits = pgTable(
  'credits',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    balance: decimal('balance', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    positiveBalance: check('positive_balance', sql`${table.balance} >= 0`),
  })
);

/**
 * Transactions table
 * Credit transaction history for auditing and billing
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type', { enum: transactionTypeEnum }).notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    balanceAfter: decimal('balance_after', {
      precision: 10,
      scale: 2,
    }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_transactions_user_id').on(table.userId),
    createdAtIdx: index('idx_transactions_created_at').on(table.createdAt),
    typeIdx: index('idx_transactions_type').on(table.type),
  })
);

// Relations
export const creditsRelations = relations(credits, ({ one, many }) => ({
  user: one(user, {
    fields: [credits.userId],
    references: [user.id],
  }),
  transactions: many(transactions),
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
