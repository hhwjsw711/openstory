import { getEnv } from '#env';
import {
  callOpenRouter,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import {
  checkForInjectionAttempts,
  sanitizeScriptContent,
  validateAIResponse,
} from '@/lib/ai/prompt-validation';
import {
  enhanceScriptPrompt,
  VELRO_UNIVERSAL_SYSTEM_PROMPT,
} from '@/lib/ai/prompts';
import { z } from 'zod';
// Input validation schema
const EnhanceScriptOptionsSchema = z.object({
  originalScript: z
    .string()
    .min(1, 'Script cannot be empty')
    .max(10000, 'Script too long'),
  targetDuration: z.number().min(15).max(60).optional().default(30),
  tone: z
    .enum(['dramatic', 'comedic', 'documentary', 'action'])
    .optional()
    .default('dramatic'),
  style: z.string().optional(),
});

// Output validation schema for the new format
const StyleStackRecommendationSchema = z.object({
  recommended_style_stack: z.string(),
  reasoning: z.string(),
});

const EnhancedScriptSchema = z.object({
  enhanced_script: z.string(),
  style_stack_recommendation: StyleStackRecommendationSchema,
});

interface EnhanceScriptOptions {
  originalScript: string;
  targetDuration?: number; // Default 30 seconds
  tone?: 'dramatic' | 'comedic' | 'documentary' | 'action';
  style?: string; // Optional style context
}

interface StyleStackRecommendation {
  recommended_style_stack: string;
  reasoning: string;
}

interface EnhancedScript {
  enhanced_script: string;
  style_stack_recommendation: StyleStackRecommendation;
}

interface ScriptEnhancementResult {
  success: boolean;
  data?: EnhancedScript;
  error?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const createSystemPrompt = (): string => {
  return VELRO_UNIVERSAL_SYSTEM_PROMPT;
};

// Create user prompt with security boundaries
const createUserPrompt = (originalScript: string): string => {
  // Apply security sanitization
  const sanitizedScript = sanitizeScriptContent(originalScript);

  return enhanceScriptPrompt(sanitizedScript);
};

// Parse the enhanced script response which contains both script text and JSON metadata
function parseEnhancedScriptResponse(response: string): {
  enhancedScript: string;
  styleRecommendation: StyleStackRecommendation;
} {
  // Look for JSON block in the response
  const jsonRegex = /```json\s*\n([\s\S]*?)\n\s*```/;
  const jsonMatch = response.match(jsonRegex);

  if (!jsonMatch) {
    throw new Error('No JSON metadata found in AI response');
  }

  let styleRecommendation: StyleStackRecommendation;
  try {
    const jsonData = JSON.parse(jsonMatch[1]);
    styleRecommendation = StyleStackRecommendationSchema.parse(jsonData);
  } catch (parseError) {
    throw new Error(
      `Failed to parse style recommendation JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
    );
  }

  // Extract the enhanced script text (everything before the JSON block)
  const scriptEndIndex = response.indexOf(jsonMatch[0]);
  let enhancedScript = response.substring(0, scriptEndIndex).trim();

  if (!enhancedScript) {
    throw new Error('No enhanced script text found in AI response');
  }

  // Remove any preamble text that might precede the actual script
  // Look for common screenplay starting patterns (allowing for line breaks and whitespace)
  const scriptStartPatterns = [
    /FADE IN:/i,
    /INT\./i,
    /EXT\./i,
    /OVER BLACK:/i,
    /TITLE CARD:/i,
    /CLOSE-UP:/i,
    /WIDE SHOT:/i,
    /ESTABLISHING SHOT:/i,
  ];

  // Find the first occurrence of any screenplay pattern
  let scriptStartIndex = -1;
  for (const pattern of scriptStartPatterns) {
    const match = enhancedScript.search(pattern);
    if (match !== -1) {
      if (scriptStartIndex === -1 || match < scriptStartIndex) {
        scriptStartIndex = match;
      }
    }
  }

  // If we found a screenplay pattern, strip everything before it
  if (scriptStartIndex > 0) {
    enhancedScript = enhancedScript.substring(scriptStartIndex).trim();
  }

  // Final check to ensure we have content
  if (!enhancedScript) {
    throw new Error(
      'No enhanced script text found in AI response after preamble removal'
    );
  }

  return {
    enhancedScript,
    styleRecommendation,
  };
}

export async function enhanceScript(
  options: EnhanceScriptOptions
): Promise<ScriptEnhancementResult> {
  try {
    // Validate input
    const validatedOptions = EnhanceScriptOptionsSchema.parse(options);

    // Security: Check for potential injection attempts before processing
    const originalScript = validatedOptions.originalScript;
    const containsSuspiciousContent = checkForInjectionAttempts(originalScript);
    if (containsSuspiciousContent) {
      console.warn('Script enhancement: Potential injection attempt detected');
    }

    // Check if OpenRouter API key is configured
    if (!getEnv().OPENROUTER_KEY) {
      throw new Error('OpenRouter API key not configured');
    }

    // Create prompts
    const systemPrompt = createSystemPrompt();
    const userPrompt = createUserPrompt(validatedOptions.originalScript);

    // Make API call to OpenRouter
    const completion = await callOpenRouter({
      model: RECOMMENDED_MODELS.structured,
      messages: [systemMessage(systemPrompt), userMessage(userPrompt)],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No response received from AI service');
    }

    // Security: Validate AI response for potential injection attempts
    validateAIResponse(response);

    // Parse the response which contains enhanced script text and JSON metadata
    const { enhancedScript, styleRecommendation } =
      parseEnhancedScriptResponse(response);

    // Create the structured response
    const validatedResponse: EnhancedScript = {
      enhanced_script: enhancedScript,
      style_stack_recommendation: styleRecommendation,
    };

    // Validate the response structure
    EnhancedScriptSchema.parse(validatedResponse);

    // Extract token usage information
    const tokenUsage = completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined;

    return {
      success: true,
      data: validatedResponse,
      tokenUsage,
    };
  } catch (error) {
    console.error('Script enhancement error:', error);

    // Handle different types of errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${error.issues.map((i) => i.message).join(', ')}`,
      };
    }

    if (error instanceof Error) {
      // Check for specific OpenRouter/OpenAI errors
      if (error.message.includes('rate limit')) {
        return {
          success: false,
          error: 'Too many requests. Please try again in a moment.',
        };
      }

      if (
        error.message.includes('insufficient_quota') ||
        error.message.includes('billing')
      ) {
        return {
          success: false,
          error: 'Service temporarily unavailable. Please try again later.',
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: 'An unexpected error occurred while enhancing the script.',
    };
  }
}

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

// Export rate limiter instance for use in server actions
export const scriptEnhancementRateLimiter = new RateLimiter(5, 60 * 1000); // 5 requests per minute
