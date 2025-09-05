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
      start: z.coerce.number().refine((val) => !Number.isNaN(val), {
        message: "Start position must be a valid number",
      }),
      end: z.coerce.number().refine((val) => !Number.isNaN(val), {
        message: "End position must be a valid number",
      }),
      description: z.string(),
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
        "You are a professional script analyst. Analyze scripts to identify scene boundaries and extract key information. You must respond with ONLY valid JSON data - no additional text, explanations, or markdown formatting. All numeric values must be actual numbers, not strings.",
      ),
      userMessage(
        `Analyze this script and identify scene boundaries:\n\n${script.slice(
          0,
          3000,
        )}${script.length > 3000 ? "..." : ""}\n\nRespond with ONLY this JSON structure (no markdown code blocks, no additional text):\n${JSON.stringify(
          {
            scenes: [
              {
                start: 0,
                end: 100,
                description: "brief scene description",
                duration: 5000,
                type: "action",
                intensity: 5,
              },
            ],
            characters: ["Character Name"],
            settings: ["Location Name"],
            themes: ["Theme"],
            totalDuration: 30000,
          },
          null,
          2,
        )}\n\nIMPORTANT: start/end are character positions (numbers), duration/totalDuration are milliseconds (numbers), intensity is 1-10 (number). Use actual numbers, not strings.`,
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
