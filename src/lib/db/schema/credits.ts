/**
 * Credits and Transactions Schema
 * User credit balances and transaction history for billing
 */

import {
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

// Enums
export const transactionType = pgEnum('transaction_type', [
  'credit_purchase',
  'credit_usage',
  'credit_refund',
  'credit_adjustment',
]);

/**
 * Credits table
 * Stores user credit balances
 */
export const credits = pgTable(
  'credits',
  {
    userId: uuid('user_id').primaryKey().notNull(),
    balance: numeric({ precision: 10, scale: 2 }).default('0.00').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'credits_user_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
    check('positive_balance', sql`balance >= (0)::numeric`),
  ]
);

/**
 * Transactions table
 * Credit transaction history for auditing and billing
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    type: transactionType().notNull(),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    balanceAfter: numeric('balance_after', {
      precision: 10,
      scale: 2,
    }).notNull(),
    metadata: jsonb().default({}),
    description: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_transactions_created_at').using(
      'btree',
      table.createdAt.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_transactions_type').using(
      'btree',
      table.type.asc().nullsLast().op('enum_ops')
    ),
    index('idx_transactions_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'transactions_user_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

// Relations
export const creditsRelations = relations(credits, ({ one }) => ({
  user: one(users, {
    fields: [credits.userId],
    references: [users.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

// Type exports
export type Credit = InferSelectModel<typeof credits>;
export type NewCredit = InferInsertModel<typeof credits>;

export type Transaction = InferSelectModel<typeof transactions>;
export type NewTransaction = InferInsertModel<typeof transactions>;

// Enum type exports
export type TransactionType = (typeof transactionType.enumValues)[number];
