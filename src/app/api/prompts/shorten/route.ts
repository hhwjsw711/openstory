/**
 * Prompt Shortening API Endpoint
 * POST /api/prompts/shorten - Shorten an image prompt using AI
 */

import {
  callOpenRouter,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import { handleApiError } from '@/lib/errors';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '#env';
// Input validation schema
const shortenPromptSchema = z.object({
  prompt: z
    .string()
    .min(20, 'Prompt must be at least 20 characters')
    .max(5000, 'Prompt too long'),
});

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

    // Get existing requests for this key
    const existingRequests = this.requests.get(key) || [];

    // Filter out requests outside the current window
    const recentRequests = existingRequests.filter(
      (time) => time > windowStart
    );

    // Check if under the limit
    if (recentRequests.length < this.maxRequests) {
      // Add current request
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

// Export rate limiter instance - 10 requests per minute
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

export type ShortenPromptRequest = z.infer<typeof shortenPromptSchema>;
export type ShortenPromptResponse = {
  success: boolean;
  data?: {
    originalPrompt: string;
    shortenedPrompt: string;
    originalLength: number;
    shortenedLength: number;
    reductionPercent: number;
  };
  message: string;
  timestamp: string;
};

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIP = headersList.get('x-real-ip');
    const clientIP = forwardedFor?.split(',')[0] || realIP || 'anonymous';

    // Check rate limiting
    if (!promptShorteningRateLimiter.isAllowed(clientIP)) {
      const remainingTimeMs =
        promptShorteningRateLimiter.getRemainingTime(clientIP);
      return NextResponse.json(
        {
          success: false,
          message: `Rate limit exceeded. Please try again in ${Math.ceil(remainingTimeMs / 1000)} seconds.`,
          timestamp: new Date().toISOString(),
          rateLimitInfo: {
            isRateLimited: true,
            remainingTimeMs,
          },
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = shortenPromptSchema.parse(body);

    // Check if OpenRouter API key is configured
    if (!env.OPENROUTER_KEY) {
      return NextResponse.json(
        {
          success: false,
          message: 'AI service not configured',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Call the AI service
    const completion = await callOpenRouter({
      model: RECOMMENDED_MODELS.fast, // Use fast model for quick response
      messages: [
        systemMessage(SHORTEN_PROMPT_SYSTEM_PROMPT),
        userMessage(validated.prompt),
      ],
      max_tokens: 500,
      temperature: 0.3, // Lower temperature for more consistent shortening
    });

    const shortenedPrompt = completion.choices[0]?.message?.content;

    if (!shortenedPrompt) {
      return NextResponse.json(
        {
          success: false,
          message: 'No response received from AI service',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Validate that shortened prompt isn't too short
    const trimmedPrompt = shortenedPrompt.trim();
    if (trimmedPrompt.length < 20) {
      return NextResponse.json(
        {
          success: false,
          message: 'Shortened prompt is too short. Please try again.',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Log token usage for monitoring
    if (completion.usage) {
      console.log('Prompt shortening token usage:', {
        clientIP: `${clientIP.substring(0, 8)}...`, // Log partial IP for privacy
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
        originalLength: validated.prompt.length,
        shortenedLength: trimmedPrompt.length,
        reductionPercent: Math.round(
          ((validated.prompt.length - trimmedPrompt.length) /
            validated.prompt.length) *
            100
        ),
      });
    }

    const response: ShortenPromptResponse = {
      success: true,
      data: {
        originalPrompt: validated.prompt,
        shortenedPrompt: trimmedPrompt,
        originalLength: validated.prompt.length,
        shortenedLength: trimmedPrompt.length,
        reductionPercent: Math.round(
          ((validated.prompt.length - trimmedPrompt.length) /
            validated.prompt.length) *
            100
        ),
      },
      message: 'Prompt shortened successfully',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[POST /api/prompts/shorten] Error:', error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to shorten prompt',
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
