/**
 * API Key Server Functions
 * End-to-end type-safe functions for managing team API keys
 *
 * Only team admins/owners can manage API keys.
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { teamAdminAccessMiddleware } from './middleware';
import { apiKeyService } from '@/lib/services/api-key.service';

const providerSchema = z.enum(['openrouter', 'fal']);

// ============================================================================
// List API Keys
// ============================================================================

const listApiKeysInputSchema = z.object({
  teamId: z.string(),
});

/**
 * List all API keys for a team (metadata only, no decrypted keys).
 */
export const listApiKeysFn = createServerFn({ method: 'GET' })
  .middleware([teamAdminAccessMiddleware])
  .inputValidator(zodValidator(listApiKeysInputSchema))
  .handler(async ({ context }) => {
    return apiKeyService.listKeys(context.teamId);
  });

// ============================================================================
// Save API Key
// ============================================================================

const saveApiKeyInputSchema = z.object({
  teamId: z.string(),
  provider: providerSchema,
  apiKey: z.string().min(1, 'API key is required'),
});

/**
 * Save (or update) an API key for a team.
 * Validates the key against the provider before saving.
 */
export const saveApiKeyFn = createServerFn({ method: 'POST' })
  .middleware([teamAdminAccessMiddleware])
  .inputValidator(zodValidator(saveApiKeyInputSchema))
  .handler(async ({ data, context }) => {
    // Validate the key first
    const validation = await apiKeyService.validateKey(
      data.provider,
      data.apiKey
    );
    if (!validation.valid) {
      throw new Error(
        `Invalid API key: ${validation.error ?? 'Validation failed'}`
      );
    }

    return apiKeyService.saveKey({
      teamId: context.teamId,
      provider: data.provider,
      apiKey: data.apiKey,
      source: 'manual',
      addedBy: context.user.id,
    });
  });

// ============================================================================
// Delete API Key
// ============================================================================

const deleteApiKeyInputSchema = z.object({
  teamId: z.string(),
  provider: providerSchema,
});

/**
 * Delete a team's API key for a specific provider.
 * Falls back to platform key after deletion.
 */
export const deleteApiKeyFn = createServerFn({ method: 'POST' })
  .middleware([teamAdminAccessMiddleware])
  .inputValidator(zodValidator(deleteApiKeyInputSchema))
  .handler(async ({ data, context }) => {
    await apiKeyService.deleteKey(context.teamId, data.provider);
  });

// ============================================================================
// Check Key Status
// ============================================================================

const checkApiKeyStatusInputSchema = z.object({
  teamId: z.string(),
});

/**
 * Check which providers have user-provided keys vs. platform keys.
 */
export const checkApiKeyStatusFn = createServerFn({ method: 'GET' })
  .middleware([teamAdminAccessMiddleware])
  .inputValidator(zodValidator(checkApiKeyStatusInputSchema))
  .handler(async ({ context }) => {
    const [hasOpenRouter, hasFal] = await Promise.all([
      apiKeyService.hasKey(context.teamId, 'openrouter'),
      apiKeyService.hasKey(context.teamId, 'fal'),
    ]);

    return {
      openrouter: hasOpenRouter ? 'team' : 'platform',
      fal: hasFal ? 'team' : 'platform',
    } as const;
  });
