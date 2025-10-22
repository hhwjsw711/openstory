/**
 * Script analysis service for frame generation
 * Analyzes scripts to identify scene boundaries and generate frame metadata
 */

import { z } from "zod";
import { sanitizeScriptContent } from "@/lib/ai/prompt-validation";
import {
  storyboardPrompt,
  VELRO_UNIVERSAL_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import type { DirectorDnaConfig } from "@/lib/services/director-dna-types";
import {
  callOpenRouter,
  extractJSON,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from "./openrouter-client";

// Scene analysis schema
const sceneAnalysisSchema = z.object({
  scenes: z.array(
    z.object({
      scriptContent: z.string(), // The actual script text for this scene
      description: z.string(), // Brief description of what happens
      duration: z.coerce
        .number()
        .refine((val) => !Number.isNaN(val), {
          message: "Duration must be a valid number",
        })
        .optional(),
      type: z.string().optional(), // e.g., "action", "dialogue", "montage"
      intensity: z.coerce
        .number()
        .min(1)
        .max(10)
        .refine((val) => !Number.isNaN(val), {
          message: "Intensity must be a valid number",
        })
        .optional(),
    }),
  ),
  characters: z.array(z.string()).optional(),
  settings: z.array(z.string()).optional(),
  themes: z.array(z.string()).optional(),
  totalDuration: z.coerce
    .number()
    .refine((val) => !Number.isNaN(val), {
      message: "Total duration must be a valid number",
    })
    .optional(),
});

export type SceneAnalysis = z.infer<typeof sceneAnalysisSchema>;

/**
 * Analyze script to identify frame boundaries
 */
export async function analyzeScriptForFrames(
  script: string,
  styleConfig: DirectorDnaConfig,
): Promise<SceneAnalysis> {
  if (!process.env.OPENROUTER_KEY) {
    throw new Error("OPENROUTER_KEY is not set");
  }

  // Use OpenRouter for AI-powered analysis
  const response = await callOpenRouter({
    model: RECOMMENDED_MODELS.structured,
    messages: [
      systemMessage(VELRO_UNIVERSAL_SYSTEM_PROMPT),
      userMessage(storyboardPrompt(sanitizeScriptContent(script), styleConfig)),
    ],
    temperature: 0.1, // Very low temperature for consistent structured output
    max_tokens: 2000, // Increased to handle full script analysis
  });

  const content = response.choices[0].message.content;
  const parsed = extractJSON<SceneAnalysis>(content);

  if (!parsed) {
    throw new Error("Failed to parse AI response - invalid or missing JSON");
  }

  // Validate and return the parsed result
  return sceneAnalysisSchema.parse(parsed);
}
