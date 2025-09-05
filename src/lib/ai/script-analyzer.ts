/**
 * Script analysis service for frame generation
 * Analyzes scripts to identify scene boundaries and generate frame metadata
 */

import { z } from "zod";
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
      start: z.coerce.number(),
      end: z.coerce.number(),
      description: z.string(),
      duration: z.coerce.number().optional(),
      type: z.string().optional(), // e.g., "action", "dialogue", "montage"
      intensity: z.coerce.number().min(1).max(10).optional(), // Emotional/action intensity
    }),
  ),
  characters: z.array(z.string()).optional(),
  settings: z.array(z.string()).optional(),
  themes: z.array(z.string()).optional(),
  totalDuration: z.coerce.number().optional(),
});

export type SceneAnalysis = z.infer<typeof sceneAnalysisSchema>;

/**
 * Analyze script to identify frame boundaries
 */
export async function analyzeScriptForFrames(
  script: string,
  aiProvider?: "openai" | "anthropic" | "openrouter",
): Promise<SceneAnalysis> {
  console.log("[ScriptAnalyzer] Analyzing script", {
    scriptLength: script.length,
    aiProvider: aiProvider || "openrouter",
  });

  if (!process.env.OPENROUTER_KEY) {
    throw new Error("OPENROUTER_KEY is not set");
  }

  // Use OpenRouter for AI-powered analysis
  const response = await callOpenRouter({
    model: RECOMMENDED_MODELS.structured,
    messages: [
      systemMessage(
        "You are a professional script analyst. Analyze scripts to identify scene boundaries, extract key information, and estimate timing. Return structured JSON data.",
      ),
      userMessage(
        `Analyze this script and identify scene boundaries:\n\n${script.slice(
          0,
          3000,
        )}${script.length > 3000 ? "..." : ""}\n\nReturn a JSON object with:\n${JSON.stringify(
          {
            scenes: [
              {
                start: "character position where scene starts",
                end: "character position where scene ends",
                description: "brief scene description",
                duration: "estimated duration in milliseconds",
                type: "action/dialogue/montage/transition",
                intensity: "1-10 emotional/action intensity",
              },
            ],
            characters: ["list of character names"],
            settings: ["list of locations/settings"],
            themes: ["key themes"],
            totalDuration: "total estimated duration in milliseconds",
          },
          null,
          2,
        )}`,
      ),
    ],
    temperature: 0.3, // Lower temperature for more consistent structured output
    max_tokens: 1000,
  });

  const content = response.choices[0].message.content;
  const parsed = extractJSON<SceneAnalysis>(content);

  if (!parsed) {
    throw new Error("Failed to parse AI response - invalid or missing JSON");
  }

  // Validate and return the parsed result
  return sceneAnalysisSchema.parse(parsed);
}
