/**
 * Authentication Schema
 * Better Auth tables and user-related tables
 */

import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';

/**
 * Better Auth user table
 * Core authentication identity table using ULID
 */
export const user = sqliteTable(
  'user',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    email: text().notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .default(false)
      .notNull(),
    name: text(),
    image: text(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull()
      .$onUpdate(() => new Date()),
    isAnonymous: integer('is_anonymous', { mode: 'boolean' }).default(false),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    onboardingCompleted: integer('onboarding_completed', {
      mode: 'boolean',
    }).default(false),
    accessCode: text(),
  },
  (table) => ({
    emailIdx: uniqueIndex('idx_user_email').on(table.email),
  })
);

/**
 * Better Auth session table
 * Tracks active user sessions
 */
export const session = sqliteTable(
  'session',
  {
    id: text().primaryKey().notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    expiresAtIdx: index('idx_session_expires_at').on(table.expiresAt),
    tokenIdx: uniqueIndex('idx_session_token').on(table.token),
    userIdIdx: index('idx_session_user_id').on(table.userId),
  })
);

/**
 * Better Auth account table
 * Links users to auth providers (OAuth, email/password, etc)
 */
export const account = sqliteTable(
  'account',
  {
    id: text().primaryKey().notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp',
    }),
    scope: text(),
    password: text(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    providerIdx: uniqueIndex('idx_account_provider').on(
      table.providerId,
      table.accountId
    ),
    userIdIdx: index('idx_account_user_id').on(table.userId),
  })
);

/**
 * Better Auth verification table
 * Manages email verification tokens
 */
export const verification = sqliteTable(
  'verification',
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    expiresAtIdx: index('idx_verification_expires_at').on(table.expiresAt),
    identifierIdx: index('idx_verification_identifier').on(table.identifier),
  })
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
