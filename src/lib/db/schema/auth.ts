/**
 * Authentication Schema
 * Better Auth tables and user-related tables
 */

import {
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from 'drizzle-orm';
import {
  boolean,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Better Auth user table
 * Core authentication identity table using UUID for Velro compatibility
 */
export const user = pgTable(
  'user',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    email: text().notNull(),
    emailVerified: boolean().default(false).notNull(),
    name: text(),
    image: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    isAnonymous: boolean().default(false),
    fullName: text(),
    avatarUrl: text(),
    onboardingCompleted: boolean().default(false),
  },
  (table) => [
    unique('user_email_key').on(table.email),
    pgPolicy('Service role full access', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

/**
 * Better Auth session table
 * Tracks active user sessions
 */
export const session = pgTable(
  'session',
  {
    id: text().primaryKey().notNull(),
    expiresAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    token: text().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid().notNull(),
  },
  (table) => [
    index('idx_session_expires_at').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops')
    ),
    index('idx_session_token').using(
      'btree',
      table.token.asc().nullsLast().op('text_ops')
    ),
    index('idx_session_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops')
    ),
    unique('session_token_key').on(table.token),
    pgPolicy('Service role full access', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

/**
 * Better Auth account table
 * Links users to auth providers (OAuth, email/password, etc)
 */
export const account = pgTable(
  'account',
  {
    id: text().primaryKey().notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true, mode: 'date' }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: 'date' }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_account_provider').using(
      'btree',
      table.providerId.asc().nullsLast().op('text_ops'),
      table.accountId.asc().nullsLast().op('text_ops')
    ),
    index('idx_account_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops')
    ),
    pgPolicy('Service role full access', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

/**
 * Better Auth verification table
 * Manages email verification tokens
 */
export const verification = pgTable(
  'verification',
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_verification_expires_at').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops')
    ),
    index('idx_verification_identifier').using(
      'btree',
      table.identifier.asc().nullsLast().op('text_ops')
    ),
    pgPolicy('Service role full access', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

// Relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Type exports
export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export type Session = InferSelectModel<typeof session>;
export type NewSession = InferInsertModel<typeof session>;

export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;

export type Verification = InferSelectModel<typeof verification>;
export type NewVerification = InferInsertModel<typeof verification>;
