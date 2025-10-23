/**
 * Better Auth Schema
 * Authentication tables managed by Better Auth library
 * Uses camelCase column names as per Better Auth conventions
 */

import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

/**
 * Better Auth user table
 * Core authentication identity table with support for email/password and OAuth
 * Synced to custom users table via trigger
 */
export const betterAuthUser = pgTable(
  'user',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    emailVerified: boolean('emailVerified').notNull().default(false),
    name: text('name'),
    image: text('image'), // OAuth profile image
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Anonymous plugin field
    isAnonymous: boolean('isAnonymous').default(false),
    // Additional custom fields
    fullName: text('fullName'),
    avatarUrl: text('avatarUrl'),
    onboardingCompleted: boolean('onboardingCompleted').default(false),
  },
  (table) => ({
    emailIdx: index('idx_user_email').on(table.email),
  })
);

/**
 * Better Auth session table
 * Stores active user sessions with expiration
 */
export const betterAuthSession = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: uuid('userId')
      .notNull()
      .references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    userIdIdx: index('idx_session_user_id').on(table.userId),
    tokenIdx: index('idx_session_token').on(table.token),
    expiresAtIdx: index('idx_session_expires_at').on(table.expiresAt),
  })
);

/**
 * Better Auth account table
 * Links users to auth providers (OAuth, email/password, etc.)
 */
export const betterAuthAccount = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: uuid('userId')
      .notNull()
      .references(() => betterAuthUser.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_account_user_id').on(table.userId),
    providerIdx: index('idx_account_provider').on(
      table.providerId,
      table.accountId
    ),
  })
);

/**
 * Better Auth verification table
 * Email verification tokens and other verification flows
 */
export const betterAuthVerification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    identifierIdx: index('idx_verification_identifier').on(table.identifier),
    expiresAtIdx: index('idx_verification_expires_at').on(table.expiresAt),
  })
);

// Relations
export const betterAuthUserRelations = relations(
  betterAuthUser,
  ({ many }) => ({
    sessions: many(betterAuthSession),
    accounts: many(betterAuthAccount),
  })
);

export const betterAuthSessionRelations = relations(
  betterAuthSession,
  ({ one }) => ({
    user: one(betterAuthUser, {
      fields: [betterAuthSession.userId],
      references: [betterAuthUser.id],
    }),
  })
);

export const betterAuthAccountRelations = relations(
  betterAuthAccount,
  ({ one }) => ({
    user: one(betterAuthUser, {
      fields: [betterAuthAccount.userId],
      references: [betterAuthUser.id],
    }),
  })
);

// Type exports
export type BetterAuthUser = InferSelectModel<typeof betterAuthUser>;
export type NewBetterAuthUser = InferInsertModel<typeof betterAuthUser>;

export type BetterAuthSession = InferSelectModel<typeof betterAuthSession>;
export type NewBetterAuthSession = InferInsertModel<typeof betterAuthSession>;

export type BetterAuthAccount = InferSelectModel<typeof betterAuthAccount>;
export type NewBetterAuthAccount = InferInsertModel<typeof betterAuthAccount>;

export type BetterAuthVerification = InferSelectModel<
  typeof betterAuthVerification
>;
export type NewBetterAuthVerification = InferInsertModel<
  typeof betterAuthVerification
>;
