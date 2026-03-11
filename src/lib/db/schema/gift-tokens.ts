import {
  type InferInsertModel,
  type InferSelectModel,
  relations,
} from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { user } from './auth';
import { teams } from './teams';

export const giftTokens = sqliteTable(
  'gift_tokens',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    code: text().unique().notNull(),
    amountMicros: integer('amount_micros').notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    redeemedByTeamId: text('redeemed_by_team_id').references(() => teams.id, {
      onDelete: 'set null',
    }),
    redeemedByUserId: text('redeemed_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    redeemedAt: integer('redeemed_at', { mode: 'timestamp' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    note: text(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('idx_gift_tokens_code').on(table.code),
    index('idx_gift_tokens_created_by').on(table.createdByUserId),
  ]
);

export const giftTokensRelations = relations(giftTokens, ({ one }) => ({
  createdBy: one(user, {
    fields: [giftTokens.createdByUserId],
    references: [user.id],
    relationName: 'giftTokens_createdBy',
  }),
  redeemedByTeam: one(teams, {
    fields: [giftTokens.redeemedByTeamId],
    references: [teams.id],
  }),
  redeemedByUser: one(user, {
    fields: [giftTokens.redeemedByUserId],
    references: [user.id],
    relationName: 'giftTokens_redeemedBy',
  }),
}));

export type GiftToken = InferSelectModel<typeof giftTokens>;
export type NewGiftToken = InferInsertModel<typeof giftTokens>;
