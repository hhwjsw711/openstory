/**
 * AI Server Functions
 * End-to-end type-safe functions for AI operations
 */

import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { getEnv } from '#env';
import {
  callLLM,
  callLLMStream,
  RECOMMENDED_MODELS,
} from '@/lib/ai/llm-client';
import {
  checkForInjectionAttempts,
  sanitizeScriptContent,
} from '@/lib/ai/prompt-validation';
import {
  createUserPrompt,
  RateLimiter,
  scriptEnhancementRateLimiter,
} from '@/lib/ai/script-enhancer';
import { getPrompt } from '@/lib/prompts';
import { isBillingEnabled } from '@/lib/billing/constants';
import { estimateLLMCost } from '@/lib/billing/cost-estimation';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { InsufficientCreditsError } from '@/lib/errors';
import { apiKeyService } from '@/lib/byok/api-key.service';
import { authWithTeamMiddleware } from './middleware';

const promptShorteningRateLimiter = new RateLimiter(10, 60_000);

const SHORTEN_PROMPT_SYSTEM = `You are an expert at condensing image generation prompts while preserving all critical visual elements.

Your task is to shorten image prompts by:
- Removing verbose descriptions and redundant words
- Keeping essential visual elements: subjects, composition, style, lighting, mood
- Maintaining technical parameters (aspect ratio, quality, etc.)
- Preserving artistic style references and specific details
- Using concise, impactful language

Target 50-75% reduction in length while keeping the prompt's core meaning intact.

Return ONLY the shortened prompt text, nothing else. No explanations, no preamble.`;

function getClientIP(): string {
  const request = getRequest();
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'anonymous'
  );
}

function enforceRateLimit(limiter: RateLimiter, key: string): void {
  if (limiter.isAllowed(key)) return;
  const remainingMs = limiter.getRemainingTime(key);
  throw new Error(
    `Rate limit exceeded. Please try again in ${Math.ceil(remainingMs / 1000)} seconds.`
  );
}

/**
 * Check pre-flight billing and return a deduct function.
 * Returns `undefined` when billing is skipped (disabled or team has own key).
 */
async function prepareBilling(
  teamId: string,
  userId: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<(() => Promise<void>) | undefined> {
  const teamHasOwnKey = await apiKeyService.hasKey(teamId, 'openrouter');
  if (!isBillingEnabled() || teamHasOwnKey) return undefined;

  const cost = estimateLLMCost(1);
  const canAfford = await hasEnoughCredits(teamId, cost);
  if (!canAfford) {
    throw new InsufficientCreditsError(
      `Insufficient credits for ${description.toLowerCase()}`
    );
  }

  return async () => {
    if (cost > 0) {
      await deductCredits(teamId, cost, { userId, description, metadata });
    }
  };
}

// -- Shorten Prompt --

const shortenPromptInputSchema = z.object({
  prompt: z
    .string()
    .min(20, 'Prompt must be at least 20 characters')
    .max(5000, 'Prompt too long'),
});

export const shortenPromptFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(shortenPromptInputSchema))
  .handler(async ({ data, context }) => {
    enforceRateLimit(promptShorteningRateLimiter, getClientIP());

    if (!getEnv().OPENROUTER_KEY) {
      throw new Error('AI service not configured');
    }

    const deduct = await prepareBilling(
      context.teamId,
      context.user.id,
      `Prompt shortening (${RECOMMENDED_MODELS.fast})`,
      { model: RECOMMENDED_MODELS.fast }
    );

    const shortenedPrompt = await callLLM({
      model: RECOMMENDED_MODELS.fast,
      messages: [
        { role: 'system' as const, content: SHORTEN_PROMPT_SYSTEM },
        { role: 'user' as const, content: data.prompt },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    await deduct?.();

    if (!shortenedPrompt) {
      throw new Error('No response received from AI service');
    }

    const trimmedPrompt = shortenedPrompt.trim();
    if (trimmedPrompt.length < 20) {
      throw new Error('Shortened prompt is too short. Please try again.');
    }

    return {
      originalPrompt: data.prompt,
      shortenedPrompt: trimmedPrompt,
      originalLength: data.prompt.length,
      shortenedLength: trimmedPrompt.length,
      reductionPercent: Math.round(
        ((data.prompt.length - trimmedPrompt.length) / data.prompt.length) * 100
      ),
    };
  });

// -- Enhance Script --

const enhanceScriptInputSchema = z.object({
  script: z
    .string()
    .min(10, 'Script must be at least 10 characters')
    .max(10000, 'Script too long'),
  targetDuration: z.number().min(15).max(60).optional(),
  tone: z.enum(['dramatic', 'comedic', 'documentary', 'action']).optional(),
  style: z.string().optional(),
});

export const enhanceScriptStreamFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(enhanceScriptInputSchema))
  .handler(async function* ({ data, context }) {
    enforceRateLimit(scriptEnhancementRateLimiter, getClientIP());

    const deduct = await prepareBilling(
      context.teamId,
      context.user.id,
      'Script enhancement'
    );

    if (checkForInjectionAttempts(data.script)) {
      console.warn('Script enhancement: Potential injection attempt detected');
    }

    const sanitized = sanitizeScriptContent(data.script);
    const { compiled } = await getPrompt('script/enhance');
    const userPrompt = createUserPrompt(sanitized);

    const systemMessage = `${compiled}\n\nReturn ONLY the enhanced script text. No JSON, no markdown formatting, no explanations.`;

    for await (const chunk of callLLMStream({
      model: RECOMMENDED_MODELS.creative,
      messages: [
        { role: 'system' as const, content: systemMessage },
        { role: 'user' as const, content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    })) {
      if (chunk.delta) {
        yield { delta: chunk.delta };
      }
    }

    await deduct?.();
  });
