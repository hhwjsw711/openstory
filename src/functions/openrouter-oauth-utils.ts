/**
 * OpenRouter OAuth shared utilities
 * Uses Turso/Drizzle for temporary PKCE state storage (replaces Redis).
 */

import { eq, lt } from 'drizzle-orm';
import { getDb } from '#db-client';
import { oauthStates } from '@/lib/db/schema';
import type { OAuthState } from '@/lib/byok/openrouter-oauth';

export const OAUTH_STATE_TTL = 600_000; // 10 minutes in ms

/**
 * Save OAuth PKCE state for a team.
 * Uses upsert so only one active flow exists per team.
 */
export async function saveOAuthState(
  teamId: string,
  state: OAuthState
): Promise<void> {
  const db = getDb();
  await db
    .insert(oauthStates)
    .values({
      teamId,
      state,
      expiresAt: Date.now() + OAUTH_STATE_TTL,
    })
    .onConflictDoUpdate({
      target: oauthStates.teamId,
      set: {
        state,
        expiresAt: Date.now() + OAUTH_STATE_TTL,
      },
    });
}

/**
 * Retrieve and delete OAuth PKCE state for a team.
 * Returns null if expired or not found.
 */
export async function getAndDeleteOAuthState(
  teamId: string
): Promise<OAuthState | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(oauthStates)
    .where(eq(oauthStates.teamId, teamId));

  if (!row || row.expiresAt < Date.now()) return null;

  await db.delete(oauthStates).where(eq(oauthStates.teamId, teamId));

  return row.state;
}

/**
 * Clean up expired OAuth states.
 * Can be called periodically or on startup.
 */
export async function cleanExpiredOAuthStates(): Promise<void> {
  const db = getDb();
  await db.delete(oauthStates).where(lt(oauthStates.expiresAt, Date.now()));
}
