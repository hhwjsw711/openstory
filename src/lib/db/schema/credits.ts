import {
  type InferInsertModel,
  type InferSelectModel,
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
import { teams } from './teams';

// Enum values as constants (SQLite doesn't have native enums)
const TRANSACTION_TYPES = [
  'credit_purchase',
  'credit_usage',
  'credit_refund',
  'credit_adjustment',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const credits = sqliteTable(
  'credits',
  {
    teamId: text('team_id')
      .primaryKey()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    balance: real().default(0.0).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [check('positive_balance', sql`${table.balance} >= 0`)]
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
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
    index('idx_transactions_created_at').on(table.createdAt),
    index('idx_transactions_type').on(table.type),
    index('idx_transactions_team_id').on(table.teamId),
    index('idx_transactions_user_id').on(table.userId),
  ]
);

export const teamBillingSettings = sqliteTable('team_billing_settings', {
  teamId: text('team_id')
    .primaryKey()
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  autoTopUpEnabled: integer('auto_top_up_enabled', { mode: 'boolean' })
    .default(true)
    .notNull(),
  autoTopUpThresholdUsd: real('auto_top_up_threshold_usd').default(5.0),
  autoTopUpAmountUsd: real('auto_top_up_amount_usd').default(25.0),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});

// Relations
export const creditsRelations = relations(credits, ({ one }) => ({
  team: one(teams, {
    fields: [credits.teamId],
    references: [teams.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  team: one(teams, {
    fields: [transactions.teamId],
    references: [teams.id],
  }),
  user: one(user, {
    fields: [transactions.userId],
    references: [user.id],
  }),
}));

export const teamBillingSettingsRelations = relations(
  teamBillingSettings,
  ({ one }) => ({
    team: one(teams, {
      fields: [teamBillingSettings.teamId],
      references: [teams.id],
    }),
  })
);

// Type exports
export type Credit = InferSelectModel<typeof credits>;
export type NewCredit = InferInsertModel<typeof credits>;

export type Transaction = InferSelectModel<typeof transactions>;
export type NewTransaction = InferInsertModel<typeof transactions>;

export type TeamBillingSetting = InferSelectModel<typeof teamBillingSettings>;
export type NewTeamBillingSetting = InferInsertModel<
  typeof teamBillingSettings
>;
