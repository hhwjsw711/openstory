/**
 * API Key Service
 *
 * Manages encrypted team API keys for external providers (OpenRouter, Fal.ai).
 * Handles CRUD operations and key resolution (team key → platform fallback).
 *
 * @module lib/services/api-key.service
 */

import { getDb } from '#db-client';
import { getEnv } from '#env';
import {
  decryptApiKey,
  encryptApiKey,
  getKeyHint,
} from '@/lib/crypto/api-key-encryption';
import { type ApiKeyProvider, teamApiKeys } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

type ApiKeyInfo = {
  id: string;
  provider: ApiKeyProvider;
  keyHint: string;
  source: 'oauth' | 'manual';
  isActive: boolean;
  addedBy: string;
  createdAt: Date;
};

/**
 * Save or update an API key for a team.
 * Encrypts the key before storage; upserts on (teamId, provider).
 */
async function saveKey(params: {
  teamId: string;
  provider: ApiKeyProvider;
  apiKey: string;
  source?: 'oauth' | 'manual';
  addedBy: string;
}): Promise<ApiKeyInfo> {
  const db = getDb();
  const encrypted = await encryptApiKey(params.apiKey);
  const hint = getKeyHint(params.apiKey);
  const now = new Date();

  // Delete existing key for this team+provider (unique constraint)
  await db
    .delete(teamApiKeys)
    .where(
      and(
        eq(teamApiKeys.teamId, params.teamId),
        eq(teamApiKeys.provider, params.provider)
      )
    );

  const [row] = await db
    .insert(teamApiKeys)
    .values({
      teamId: params.teamId,
      provider: params.provider,
      encryptedKey: encrypted.encryptedKey,
      keyIv: encrypted.keyIv,
      keyTag: encrypted.keyTag,
      keyHint: hint,
      source: params.source ?? 'manual',
      isActive: true,
      addedBy: params.addedBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    id: row.id,
    provider: row.provider,
    keyHint: row.keyHint,
    source: row.source,
    isActive: row.isActive,
    addedBy: row.addedBy,
    createdAt: row.createdAt,
  };
}

/**
 * Get the display info for a team's API keys (no decryption).
 */
async function listKeys(teamId: string): Promise<ApiKeyInfo[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: teamApiKeys.id,
      provider: teamApiKeys.provider,
      keyHint: teamApiKeys.keyHint,
      source: teamApiKeys.source,
      isActive: teamApiKeys.isActive,
      addedBy: teamApiKeys.addedBy,
      createdAt: teamApiKeys.createdAt,
    })
    .from(teamApiKeys)
    .where(eq(teamApiKeys.teamId, teamId));

  return rows as ApiKeyInfo[];
}

/**
 * Delete a team's API key for a provider.
 */
async function deleteKey(
  teamId: string,
  provider: ApiKeyProvider
): Promise<void> {
  const db = getDb();
  await db
    .delete(teamApiKeys)
    .where(
      and(eq(teamApiKeys.teamId, teamId), eq(teamApiKeys.provider, provider))
    );
}

/**
 * Check whether a team has their own key for a provider.
 */
async function hasKey(
  teamId: string,
  provider: ApiKeyProvider
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: teamApiKeys.id })
    .from(teamApiKeys)
    .where(
      and(
        eq(teamApiKeys.teamId, teamId),
        eq(teamApiKeys.provider, provider),
        eq(teamApiKeys.isActive, true)
      )
    )
    .limit(1);

  return !!row;
}

/**
 * Resolve the API key for a given provider and team.
 * Returns the team's own key if configured, otherwise falls back to the platform key.
 *
 * This is the primary function used by AI clients and workflows.
 */
async function resolveKey(
  provider: ApiKeyProvider,
  teamId?: string
): Promise<{ key: string; source: 'team' | 'platform' }> {
  if (teamId) {
    const db = getDb();

    const [row] = await db
      .select({
        encryptedKey: teamApiKeys.encryptedKey,
        keyIv: teamApiKeys.keyIv,
        keyTag: teamApiKeys.keyTag,
      })
      .from(teamApiKeys)
      .where(
        and(
          eq(teamApiKeys.teamId, teamId),
          eq(teamApiKeys.provider, provider),
          eq(teamApiKeys.isActive, true)
        )
      )
      .limit(1);

    if (row) {
      const decrypted = await decryptApiKey({
        encryptedKey: row.encryptedKey,
        keyIv: row.keyIv,
        keyTag: row.keyTag,
      });
      return { key: decrypted, source: 'team' };
    }
  }
  // Fall back to platform key
  const env = getEnv();
  const platformKey =
    provider === 'openrouter' ? env.OPENROUTER_KEY : env.FAL_KEY;

  if (!platformKey) {
    throw new Error(`No API key available for provider: ${provider}`);
  }

  return { key: platformKey, source: 'platform' };
}

/**
 * Validate an API key by making a lightweight test call to the provider.
 */
async function validateKey(
  provider: ApiKeyProvider,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  if (provider === 'openrouter') {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) return { valid: true };
    return { valid: false, error: `OpenRouter returned ${response.status}` };
  }

  if (provider === 'fal') {
    // Fal.ai doesn't have a dedicated key validation endpoint.
    // POST with empty body: valid key → 422 (missing input), invalid key → 401.
    const response = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (response.status === 401) {
      return { valid: false, error: 'Invalid Fal.ai API key' };
    }
    return { valid: true };
  }

  throw new Error(`Unknown provider`);
}

export const apiKeyService = {
  saveKey,
  listKeys,
  deleteKey,
  hasKey,
  resolveKey,
  validateKey,
};
