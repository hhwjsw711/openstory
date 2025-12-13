/**
 * Script Enhancement API Endpoint (TanStack Start)
 * POST /api/script/enhance - Enhance a script using AI
 */

import {
  enhanceScript as enhanceScriptService,
  scriptEnhancementRateLimiter,
} from '@/lib/ai/script-enhancer';
import { errorResponse, json, successResponse } from '@/lib/api/response';
import { handleApiError } from '@/lib/errors';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const enhanceScriptSchema = z.object({
  script: z
    .string()
    .min(10, 'Script must be at least 10 characters')
    .max(10000, 'Script too long'),
  targetDuration: z.number().min(15).max(60).optional(),
  tone: z.enum(['dramatic', 'comedic', 'documentary', 'action']).optional(),
  style: z.string().optional(),
});

export const Route = createFileRoute('/api/script/enhance')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Get client IP for rate limiting
          const forwardedFor = request.headers.get('x-forwarded-for');
          const realIP = request.headers.get('x-real-ip');
          const clientIP = forwardedFor?.split(',')[0] || realIP || 'anonymous';

          // Check rate limiting
          if (!scriptEnhancementRateLimiter.isAllowed(clientIP)) {
            const remainingTimeMs =
              scriptEnhancementRateLimiter.getRemainingTime(clientIP);
            return json(
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
          const validated = enhanceScriptSchema.parse(body);

          // Call the AI service
          const result = await enhanceScriptService({
            originalScript: validated.script,
            targetDuration: validated.targetDuration,
            tone: validated.tone,
            style: validated.style || undefined,
          });

          if (!result.success) {
            return json(
              {
                success: false,
                message: result.error || 'Failed to enhance script',
                timestamp: new Date().toISOString(),
              },
              { status: 500 }
            );
          }

          if (!result.data) {
            return json(
              {
                success: false,
                message: 'No enhanced script data received',
                timestamp: new Date().toISOString(),
              },
              { status: 500 }
            );
          }

          // Log token usage for monitoring
          if (result.tokenUsage) {
            console.log('Script enhancement token usage:', {
              clientIP: `${clientIP.substring(0, 8)}...`, // Log partial IP for privacy
              promptTokens: result.tokenUsage.promptTokens,
              completionTokens: result.tokenUsage.completionTokens,
              totalTokens: result.tokenUsage.totalTokens,
              originalScriptLength: validated.script.length,
              enhancedScriptLength: result.data.enhanced_script.length,
            });
          }

          return successResponse(
            {
              originalScript: validated.script,
              enhancedScript: result.data.enhanced_script,
              styleStackRecommendation: result.data.style_stack_recommendation,
            },
            'Script enhanced successfully'
          );
        } catch (error) {
          console.error('[POST /api/script/enhance] Error:', error);
          const handledError = handleApiError(error);
          return errorResponse(
            'Failed to enhance script',
            handledError.statusCode,
            { error: handledError.toJSON() }
          );
        }
      },
    },
  },
});
