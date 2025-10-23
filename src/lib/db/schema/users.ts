/**
 * Users Schema
 * Custom user profile table synced from Better Auth via trigger
 * Stores application-specific user data separate from auth concerns
 */

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel, relations } from 'drizzle-orm';

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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
}));

// Import for relations (placed after table definition to avoid circular deps)
import { teamMembers } from './teams';

// Type exports
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
