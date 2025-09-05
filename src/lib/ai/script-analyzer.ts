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

  // Use OpenRouter for AI-powered analysis if available
  if (aiProvider === "openrouter" && process.env.OPENROUTER_KEY) {
    try {
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

      if (parsed) {
        try {
          return sceneAnalysisSchema.parse(parsed);
        } catch (error) {
          console.error("[ScriptAnalyzer] Invalid OpenRouter response:", error);
          // Fall back to heuristic analysis
        }
      }
    } catch (error) {
      console.error("[ScriptAnalyzer] OpenRouter error:", error);
      // Fall back to heuristic analysis
    }
  }

  // Fall back to heuristic-based approach
  const analysis = performHeuristicAnalysis(script);

  // Validate the analysis
  try {
    return sceneAnalysisSchema.parse(analysis);
  } catch (error) {
    console.error("[ScriptAnalyzer] Invalid analysis result:", error);
    // Return a fallback single-scene analysis
    return {
      scenes: [
        {
          start: 0,
          end: script.length,
          description: "Complete script as single scene",
          duration: 30000, // 30 seconds default
        },
      ],
      characters: [],
      settings: [],
      totalDuration: 30000,
    };
  }
}

/**
 * Perform heuristic-based script analysis
 */
function performHeuristicAnalysis(script: string): SceneAnalysis {
  const scenes: SceneAnalysis["scenes"] = [];
  const characters = new Set<string>();
  const settings = new Set<string>();

  // Split script into potential scenes
  const sceneMarkers = findSceneMarkers(script);

  if (sceneMarkers.length === 0) {
    // No scene markers found, treat as single scene
    return {
      scenes: [
        {
          start: 0,
          end: script.length,
          description: extractSceneDescription(script, 0, script.length),
          duration: estimateDuration(script),
          type: detectSceneType(script),
          intensity: estimateIntensity(script),
        },
      ],
      characters: extractCharacters(script),
      settings: extractSettings(script),
      totalDuration: estimateDuration(script),
    };
  }

  // Process each scene
  for (let i = 0; i < sceneMarkers.length; i++) {
    const start = sceneMarkers[i];
    const end =
      i < sceneMarkers.length - 1 ? sceneMarkers[i + 1] : script.length;
    const sceneText = script.slice(start, end);

    scenes.push({
      start,
      end,
      description: extractSceneDescription(script, start, end),
      duration: estimateDuration(sceneText),
      type: detectSceneType(sceneText),
      intensity: estimateIntensity(sceneText),
    });

    // Extract characters and settings from this scene
    for (const char of extractCharacters(sceneText)) {
      characters.add(char);
    }
    for (const setting of extractSettings(sceneText)) {
      settings.add(setting);
    }
  }

  const totalDuration = scenes.reduce(
    (sum, scene) => sum + (scene.duration || 0),
    0,
  );

  return {
    scenes,
    characters: Array.from(characters),
    settings: Array.from(settings),
    themes: extractThemes(script),
    totalDuration,
  };
}

/**
 * Find scene markers in the script
 */
function findSceneMarkers(script: string): number[] {
  const markers: number[] = [0]; // Always start with beginning

  // Common scene indicators
  const scenePatterns = [
    /\n\s*INT\./gi,
    /\n\s*EXT\./gi,
    /\n\s*SCENE\s+\d+/gi,
    /\n\s*CUT TO:/gi,
    /\n\s*FADE IN:/gi,
    /\n\s*FADE OUT:/gi,
    /\n{3,}/g, // Multiple newlines often indicate scene breaks
  ];

  for (const pattern of scenePatterns) {
    let match: RegExpExecArray | null;
    match = pattern.exec(script);
    while (match !== null) {
      if (!markers.includes(match.index)) {
        markers.push(match.index);
      }
      match = pattern.exec(script);
    }
  }

  // Sort markers and filter out those too close together
  markers.sort((a, b) => a - b);
  const filteredMarkers = [markers[0]];

  for (let i = 1; i < markers.length; i++) {
    // Keep markers that are at least 200 characters apart
    if (markers[i] - filteredMarkers[filteredMarkers.length - 1] > 200) {
      filteredMarkers.push(markers[i]);
    }
  }

  return filteredMarkers;
}

/**
 * Extract scene description from script segment
 */
function extractSceneDescription(
  script: string,
  start: number,
  end: number,
): string {
  const segment = script.slice(start, Math.min(end, start + 500)).trim();

  // Remove dialogue markers
  const cleaned = segment
    .replace(/^[A-Z\s]+:/gm, "") // Remove character names
    .replace(/\([^)]+\)/g, "") // Remove parentheticals
    .trim();

  // Take first meaningful sentence or chunk
  const sentences = cleaned.split(/[.!?]+/);
  const description = sentences[0]?.trim() || "Scene transition";

  // Limit length and clean up
  return description.slice(0, 200).replace(/\s+/g, " ").trim();
}

/**
 * Extract character names from script
 */
function extractCharacters(script: string): string[] {
  const characters = new Set<string>();

  // Look for dialogue markers (CHARACTER NAME:)
  const dialoguePattern = /^([A-Z][A-Z\s]+):/gm;
  let match: RegExpExecArray | null;
  match = dialoguePattern.exec(script);
  while (match !== null) {
    const name = match[1].trim();
    // Filter out common non-character markers
    if (
      !["INT", "EXT", "CUT TO", "FADE IN", "FADE OUT", "THE END"].includes(name)
    ) {
      characters.add(name);
    }
    match = dialoguePattern.exec(script);
  }

  // Also look for character mentions in action lines
  const actionPattern = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g;
  let actionMatch: RegExpExecArray | null;
  actionMatch = actionPattern.exec(script);
  while (actionMatch !== null) {
    const name = actionMatch[1];
    // Basic validation - likely a character name
    if (name.split(" ").every((part) => part.length > 2)) {
      characters.add(name);
    }
    actionMatch = actionPattern.exec(script);
  }

  return Array.from(characters).slice(0, 10); // Limit to 10 main characters
}

/**
 * Extract settings/locations from script
 */
function extractSettings(script: string): string[] {
  const settings = new Set<string>();

  // Look for location markers
  const locationPatterns = [/INT\.\s+([^-\n]+)/gi, /EXT\.\s+([^-\n]+)/gi];

  for (const pattern of locationPatterns) {
    let match: RegExpExecArray | null;
    match = pattern.exec(script);
    while (match !== null) {
      const location = match[1].trim().replace(/\s*-\s*.*$/, ""); // Remove time indicators
      if (location) {
        settings.add(location);
      }
      match = pattern.exec(script);
    }
  }

  // If no formal locations found, try to extract from content
  if (settings.size === 0) {
    const commonLocations = [
      "office",
      "home",
      "street",
      "car",
      "restaurant",
      "park",
      "hospital",
      "school",
      "apartment",
      "house",
      "room",
      "building",
    ];

    const lowerScript = script.toLowerCase();
    for (const location of commonLocations) {
      if (lowerScript.includes(location)) {
        settings.add(location.charAt(0).toUpperCase() + location.slice(1));
      }
    }
  }

  return Array.from(settings).slice(0, 5); // Limit to 5 main settings
}

/**
 * Extract themes from script
 */
function extractThemes(script: string): string[] {
  const themes: string[] = [];
  const lowerScript = script.toLowerCase();

  const themeKeywords = {
    love: ["love", "romance", "heart", "kiss", "relationship"],
    action: ["fight", "chase", "explosion", "battle", "combat"],
    mystery: ["mystery", "clue", "detective", "investigate", "secret"],
    comedy: ["laugh", "funny", "joke", "humor", "hilarious"],
    drama: ["emotion", "conflict", "tension", "struggle", "crisis"],
    thriller: ["danger", "threat", "escape", "pursuit", "fear"],
    "sci-fi": ["future", "technology", "space", "alien", "robot"],
    horror: ["scary", "terror", "monster", "nightmare", "blood"],
  };

  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    const count = keywords.filter((keyword) =>
      lowerScript.includes(keyword),
    ).length;
    if (count >= 2) {
      themes.push(theme);
    }
  }

  return themes.slice(0, 3); // Return top 3 themes
}

/**
 * Detect the type of scene
 */
function detectSceneType(sceneText: string): string {
  const lower = sceneText.toLowerCase();

  // Check for dialogue-heavy scenes
  const dialogueLines = (sceneText.match(/^[A-Z\s]+:/gm) || []).length;
  const totalLines = sceneText.split("\n").length;
  const dialogueRatio = dialogueLines / Math.max(totalLines, 1);

  if (dialogueRatio > 0.5) return "dialogue";

  // Check for action indicators
  if (
    lower.includes("fight") ||
    lower.includes("chase") ||
    lower.includes("run")
  ) {
    return "action";
  }

  // Check for montage indicators
  if (lower.includes("montage") || lower.includes("series of")) {
    return "montage";
  }

  // Check for transition
  if (lower.includes("cut to") || lower.includes("fade")) {
    return "transition";
  }

  return "standard";
}

/**
 * Estimate scene duration based on content
 */
function estimateDuration(sceneText: string): number {
  // Base estimation: ~150 words per minute for dialogue, ~200 for action
  const wordCount = sceneText.split(/\s+/).length;
  const dialogueLines = (sceneText.match(/^[A-Z\s]+:/gm) || []).length;

  // More dialogue = slower pacing
  const wordsPerMinute = dialogueLines > 5 ? 150 : 200;
  const minutes = wordCount / wordsPerMinute;

  // Convert to milliseconds with minimum 3 seconds, maximum 60 seconds
  const duration = Math.max(3000, Math.min(60000, Math.round(minutes * 60000)));

  return duration;
}

/**
 * Estimate emotional/action intensity
 */
function estimateIntensity(sceneText: string): number {
  const lower = sceneText.toLowerCase();
  let intensity = 5; // Default medium intensity

  // High intensity indicators
  const highIntensityWords = [
    "explosion",
    "fight",
    "scream",
    "crash",
    "death",
    "kill",
    "emergency",
    "panic",
    "terror",
    "desperate",
    "violent",
  ];

  // Low intensity indicators
  const lowIntensityWords = [
    "quiet",
    "peaceful",
    "calm",
    "gentle",
    "soft",
    "relax",
    "serene",
    "tranquil",
    "still",
    "rest",
  ];

  const highCount = highIntensityWords.filter((word) =>
    lower.includes(word),
  ).length;
  const lowCount = lowIntensityWords.filter((word) =>
    lower.includes(word),
  ).length;

  // Adjust intensity based on word counts
  intensity += highCount * 2;
  intensity -= lowCount * 2;

  // Check for exclamation marks (high energy)
  const exclamationCount = (sceneText.match(/!/g) || []).length;
  intensity += Math.min(exclamationCount / 2, 2);

  // Clamp between 1 and 10
  return Math.max(1, Math.min(10, Math.round(intensity)));
}
