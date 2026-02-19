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
  callOpenRouter,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import {
  enhanceScript as enhanceScriptService,
  scriptEnhancementRateLimiter,
} from '@/lib/ai/script-enhancer';
import { authWithTeamMiddleware } from './middleware';
import { isBillingEnabled } from '@/lib/billing/constants';
import { estimateLLMCost } from '@/lib/billing/cost-estimation';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { InsufficientCreditsError } from '@/lib/errors';
import { apiKeyService } from '@/lib/services/api-key.service';

// Rate limiting utility (simple in-memory implementation)
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const existingRequests = this.requests.get(key) || [];
    const recentRequests = existingRequests.filter(
      (time) => time > windowStart
    );

    if (recentRequests.length < this.maxRequests) {
      recentRequests.push(now);
      this.requests.set(key, recentRequests);
      return true;
    }

    return false;
  }

  getRemainingTime(key: string): number {
    const requests = this.requests.get(key);
    if (!requests || requests.length === 0) return 0;

    const oldestRequest = Math.min(...requests);
    const windowEnd = oldestRequest + this.windowMs;
    const remaining = windowEnd - Date.now();

    return Math.max(0, remaining);
  }
}

// Rate limiter instance - 10 requests per minute
const promptShorteningRateLimiter = new RateLimiter(10, 60 * 1000);

// System prompt for shortening image prompts
const SHORTEN_PROMPT_SYSTEM_PROMPT = `You are an expert at condensing image generation prompts while preserving all critical visual elements.

Your task is to shorten image prompts by:
- Removing verbose descriptions and redundant words
- Keeping essential visual elements: subjects, composition, style, lighting, mood
- Maintaining technical parameters (aspect ratio, quality, etc.)
- Preserving artistic style references and specific details
- Using concise, impactful language

Target 50-75% reduction in length while keeping the prompt's core meaning intact.

Return ONLY the shortened prompt text, nothing else. No explanations, no preamble.`;

// Helper to get client IP from request
function getClientIP(): string {
  const request = getRequest();
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwardedFor?.split(',')[0] || realIP || 'anonymous';
}

// ============================================================================
// Shorten Prompt
// ============================================================================

const shortenPromptInputSchema = z.object({
  prompt: z
    .string()
    .min(20, 'Prompt must be at least 20 characters')
    .max(5000, 'Prompt too long'),
});

/**
 * Shorten an image prompt using AI
 * @returns The shortened prompt with statistics
 */
export const shortenPromptFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(shortenPromptInputSchema))
  .handler(async ({ data, context }) => {
    const clientIP = getClientIP();

    // Check rate limiting
    if (!promptShorteningRateLimiter.isAllowed(clientIP)) {
      const remainingTimeMs =
        promptShorteningRateLimiter.getRemainingTime(clientIP);
      throw new Error(
        `Rate limit exceeded. Please try again in ${Math.ceil(remainingTimeMs / 1000)} seconds.`
      );
    }

    const env = getEnv();

    // Check if OpenRouter API key is configured
    if (!env.OPENROUTER_KEY) {
      throw new Error('AI service not configured');
    }

    // Pre-flight billing check (skip if team has own OpenRouter key or billing disabled)
    const teamHasOrKey = await apiKeyService.hasKey(
      context.teamId,
      'openrouter'
    );
    if (isBillingEnabled() && !teamHasOrKey) {
      const estimatedCost = estimateLLMCost(1);
      const canAfford = await hasEnoughCredits(context.teamId, estimatedCost);
      if (!canAfford) {
        throw new InsufficientCreditsError(
          'Insufficient credits for prompt shortening'
        );
      }
    }

    // Call the AI service (returns text directly via TanStack AI adapter)
    const shortenedPrompt = await callOpenRouter({
      model: RECOMMENDED_MODELS.fast,
      messages: [
        systemMessage(SHORTEN_PROMPT_SYSTEM_PROMPT),
        userMessage(data.prompt),
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    // Deduct estimated cost (skip if team has own key or billing disabled)
    if (isBillingEnabled() && !teamHasOrKey) {
      const estimatedCost = estimateLLMCost(1);
      if (estimatedCost > 0) {
        await deductCredits(context.teamId, estimatedCost, {
          userId: context.user.id,
          description: `Prompt shortening (${RECOMMENDED_MODELS.fast})`,
          metadata: { model: RECOMMENDED_MODELS.fast },
        });
      }
    }

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

// ============================================================================
// Enhance Script
// ============================================================================

const enhanceScriptInputSchema = z.object({
  script: z
    .string()
    .min(10, 'Script must be at least 10 characters')
    .max(10000, 'Script too long'),
  targetDuration: z.number().min(15).max(60).optional(),
  tone: z.enum(['dramatic', 'comedic', 'documentary', 'action']).optional(),
  style: z.string().optional(),
});

/**
 * Enhance a script using AI
 * @returns The enhanced script with recommendations
 */
export const enhanceScriptFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(enhanceScriptInputSchema))
  .handler(async ({ data, context }) => {
    const clientIP = getClientIP();

    // Check rate limiting
    if (!scriptEnhancementRateLimiter.isAllowed(clientIP)) {
      const remainingTimeMs =
        scriptEnhancementRateLimiter.getRemainingTime(clientIP);
      throw new Error(
        `Rate limit exceeded. Please try again in ${Math.ceil(remainingTimeMs / 1000)} seconds.`
      );
    }

    // Pre-flight billing check (skip if team has own OpenRouter key or billing disabled)
    const teamHasOrKey = await apiKeyService.hasKey(
      context.teamId,
      'openrouter'
    );
    if (isBillingEnabled() && !teamHasOrKey) {
      const estimatedCost = estimateLLMCost(1);
      const canAfford = await hasEnoughCredits(context.teamId, estimatedCost);
      if (!canAfford) {
        throw new InsufficientCreditsError(
          'Insufficient credits for script enhancement'
        );
      }
    }

    // Call the AI service
    const result = await enhanceScriptService({
      originalScript: data.script,
      targetDuration: data.targetDuration,
      tone: data.tone,
      style: data.style || undefined,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to enhance script');
    }

    // Deduct estimated LLM cost (skip if team has own key or billing disabled)
    if (isBillingEnabled() && !teamHasOrKey) {
      const cost = estimateLLMCost(1);
      if (cost > 0) {
        await deductCredits(context.teamId, cost, {
          userId: context.user.id,
          description: 'Script enhancement',
        });
      }
    }

    return {
      originalScript: data.script,
      enhancedScript: result.data.enhanced_script,
      styleStackRecommendation: result.data.style_stack_recommendation,
    };
  });
