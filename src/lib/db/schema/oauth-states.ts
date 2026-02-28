/**
 * OAuth States Schema
 * Temporary storage for OAuth PKCE state during authorization flows.
 * Rows auto-expire via the expiresAt timestamp.
 */

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { OAuthState } from '@/lib/byok/openrouter-oauth';

/**
 * OAuth states table — one active flow per team.
 * Replaces Redis key-value TTL storage for OAuth PKCE state.
 */
export const oauthStates = sqliteTable('oauth_states', {
  teamId: text('team_id').primaryKey().notNull(),
  state: text({ mode: 'json' }).notNull().$type<OAuthState>(),
  expiresAt: integer('expires_at').notNull(),
});
