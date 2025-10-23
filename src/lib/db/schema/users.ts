/**
 * Users Schema
 * Custom user profile table synced from Better Auth via trigger
 * Stores application-specific user data separate from auth concerns
 */

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

/**
 * Velro users table
 * Synced from Better Auth user table via sync_betterauth_to_users trigger
 * Contains application-specific profile information
 * Note: Email is stored in Better Auth user table, not here
 */
export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Note: Relations to team_members, credits, etc. will be defined in their respective schema files
// to avoid circular dependencies

// Type exports
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
