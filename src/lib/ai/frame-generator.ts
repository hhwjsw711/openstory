/**
 * Frame generation service using AI
 * Generates detailed visual descriptions for storyboard frames
 */

import { z } from "zod";
import type { Json } from "@/types/database";
import {
  callOpenRouter,
  extractJSON,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from "./openrouter-client";

// Frame description schema
const frameDescriptionSchema = z.object({
  description: z.string(),
  visualElements: z.object({
    shotType: z.string(), // e.g., "wide shot", "close-up", "medium shot"
    cameraAngle: z.string(), // e.g., "eye level", "low angle", "high angle"
    lighting: z.string(), // e.g., "natural daylight", "dramatic shadows", "soft lighting"
    mood: z.string(), // e.g., "tense", "joyful", "mysterious"
    colorPalette: z.array(z.string()).optional(),
  }),
  characters: z.array(z.string()).optional(),
  settings: z.array(z.string()).optional(),
  action: z.string().optional(),
  dialogue: z.string().optional(),
});

export type FrameDescription = z.infer<typeof frameDescriptionSchema>;

export interface GenerateFrameDescriptionsParams {
  script: string;
  scriptAnalysis: {
    scenes: Array<{
      start: number;
      end: number;
      description: string;
      duration?: number;
    }>;
    characters?: string[];
    settings?: string[];
  };
  styleStack?: Json;
  framesPerScene?: number;
  aiProvider?: "openai" | "anthropic" | "openrouter";
}

export interface FrameDescriptionResult {
  frames: Array<{
    description: string;
    orderIndex: number;
    durationMs: number;
    metadata: {
      scene: number;
      shotType?: string;
      cameraAngle?: string;
      lighting?: string;
      mood?: string;
      characters?: string[];
      settings?: string[];
      action?: string;
      dialogue?: string;
      visualElements?: Record<string, unknown>;
    };
  }>;
  totalDuration: number;
  frameCount: number;
}

/**
 * Generate frame descriptions for a sequence
 */
export async function generateFrameDescriptions(
  params: GenerateFrameDescriptionsParams,
): Promise<FrameDescriptionResult> {
  const {
    script,
    scriptAnalysis,
    styleStack,
    framesPerScene = 5,
    aiProvider = "openrouter",
  } = params;

  console.log("[FrameGenerator] Generating frame descriptions", {
    scenes: scriptAnalysis.scenes.length,
    framesPerScene,
    aiProvider,
  });

  const frames: FrameDescriptionResult["frames"] = [];
  let orderIndex = 0;
  let totalDuration = 0;

  // Process each scene
  for (
    let sceneIndex = 0;
    sceneIndex < scriptAnalysis.scenes.length;
    sceneIndex++
  ) {
    const scene = scriptAnalysis.scenes[sceneIndex];
    const sceneDuration = scene.duration || 5000; // Default 5 seconds per scene
    const frameDuration = sceneDuration / framesPerScene;

    // Extract scene-specific script portion
    const sceneScript = script.slice(scene.start, scene.end);

    // Generate frames for this scene
    const sceneFrames = await generateSceneFrames({
      sceneScript,
      sceneDescription: scene.description,
      sceneIndex,
      frameCount: framesPerScene,
      frameDuration,
      styleStack,
      characters: scriptAnalysis.characters,
      settings: scriptAnalysis.settings,
      aiProvider,
    });

    // Add frames with proper ordering
    for (const frame of sceneFrames) {
      frames.push({
        ...frame,
        orderIndex: orderIndex++,
      });
      totalDuration += frame.durationMs;
    }
  }

  return {
    frames,
    totalDuration,
    frameCount: frames.length,
  };
}

/**
 * Generate frames for a single scene
 */
async function generateSceneFrames(params: {
  sceneScript: string;
  sceneDescription: string;
  sceneIndex: number;
  frameCount: number;
  frameDuration: number;
  styleStack?: Json;
  characters?: string[];
  settings?: string[];
  aiProvider: "openai" | "anthropic" | "openrouter";
}): Promise<Omit<FrameDescriptionResult["frames"][0], "orderIndex">[]> {
  const {
    sceneScript,
    sceneDescription,
    sceneIndex,
    frameCount,
    frameDuration,
    styleStack,
    characters,
    settings,
    aiProvider,
  } = params;

  // For now, we'll create mock frame descriptions
  // In production, this would call the actual AI API
  const frames: Omit<FrameDescriptionResult["frames"][0], "orderIndex">[] = [];

  // Define shot progression for the scene
  const shotProgression = getShotProgression(frameCount);

  for (let i = 0; i < frameCount; i++) {
    const shotType = shotProgression[i];
    const isFirstFrame = i === 0;
    const isLastFrame = i === frameCount - 1;

    // Create frame description based on position in scene
    const frameDescription = await createFrameDescription({
      sceneScript,
      sceneDescription,
      framePosition: i,
      totalFrames: frameCount,
      shotType,
      isFirstFrame,
      isLastFrame,
      styleStack,
      characters,
      settings,
      aiProvider,
    });

    frames.push({
      description: frameDescription.description,
      durationMs: Math.round(frameDuration),
      metadata: {
        scene: sceneIndex,
        shotType: frameDescription.visualElements.shotType,
        cameraAngle: frameDescription.visualElements.cameraAngle,
        lighting: frameDescription.visualElements.lighting,
        mood: frameDescription.visualElements.mood,
        characters: frameDescription.characters,
        settings: frameDescription.settings,
        action: frameDescription.action,
        dialogue: frameDescription.dialogue,
        visualElements: frameDescription.visualElements,
      },
    });
  }

  return frames;
}

/**
 * Create a single frame description
 */
async function createFrameDescription(params: {
  sceneScript: string;
  sceneDescription: string;
  framePosition: number;
  totalFrames: number;
  shotType: string;
  isFirstFrame: boolean;
  isLastFrame: boolean;
  styleStack?: Json;
  characters?: string[];
  settings?: string[];
  aiProvider: "openai" | "anthropic" | "openrouter";
}): Promise<FrameDescription> {
  const {
    sceneScript,
    sceneDescription,
    framePosition,
    totalFrames,
    shotType,
    isFirstFrame,
    isLastFrame,
    styleStack,
    characters = [],
    settings = [],
  } = params;

  // Build the prompt for AI
  const prompt = buildFramePrompt({
    sceneScript,
    sceneDescription,
    framePosition,
    totalFrames,
    shotType,
    isFirstFrame,
    isLastFrame,
    styleStack,
    characters,
    settings,
  });

  // Use OpenRouter to generate frame description if provider is set
  if (params.aiProvider === "openrouter" && process.env.OPENROUTER_API_KEY) {
    try {
      const response = await callOpenRouter({
        model: RECOMMENDED_MODELS.creative,
        messages: [
          systemMessage(
            "You are a professional storyboard artist and cinematographer. Generate detailed, cinematic frame descriptions for video production. Return your response as a JSON object matching the provided schema.",
          ),
          userMessage(
            `${prompt}\n\nReturn a JSON object with this structure:\n${JSON.stringify(
              {
                description: "detailed frame description",
                visualElements: {
                  shotType: "shot type",
                  cameraAngle: "camera angle",
                  lighting: "lighting description",
                  mood: "mood/atmosphere",
                  colorPalette: ["color1", "color2", "color3"],
                },
                characters: ["character names if present"],
                settings: ["location/setting names"],
                action: "main action in frame",
                dialogue: "any dialogue if present",
              },
              null,
              2,
            )}`,
          ),
        ],
        temperature: 0.8,
        max_tokens: 500,
      });

      const content = response.choices[0].message.content;
      const parsed = extractJSON<FrameDescription>(content);

      if (parsed) {
        // Validate and ensure all required fields
        return {
          description:
            parsed.description ||
            generateMockDescription({
              sceneDescription,
              framePosition,
              totalFrames,
              shotType,
              characters,
              settings,
            }),
          visualElements: {
            shotType: parsed.visualElements?.shotType || shotType,
            cameraAngle: parsed.visualElements?.cameraAngle || "eye level",
            lighting:
              parsed.visualElements?.lighting ||
              getMockLighting(framePosition, totalFrames),
            mood: parsed.visualElements?.mood || getMockMood(sceneDescription),
            colorPalette: parsed.visualElements?.colorPalette,
          },
          characters: parsed.characters || characters.slice(0, 2),
          settings: parsed.settings || settings.slice(0, 1),
          action: parsed.action,
          dialogue: parsed.dialogue,
        };
      }
    } catch (error) {
      console.error("[FrameGenerator] OpenRouter error:", error);
      // Fall back to mock on error
    }
  }

  // Fall back to mock response
  const mockDescription: FrameDescription = {
    description: generateMockDescription({
      sceneDescription,
      framePosition,
      totalFrames,
      shotType,
      characters,
      settings,
    }),
    visualElements: {
      shotType,
      cameraAngle: isFirstFrame
        ? "eye level"
        : framePosition % 2 === 0
          ? "low angle"
          : "high angle",
      lighting: getMockLighting(framePosition, totalFrames),
      mood: getMockMood(sceneDescription),
      colorPalette: getMockColorPalette(styleStack),
    },
    characters: characters.slice(0, Math.min(2, characters.length)),
    settings: settings.slice(0, 1),
    action: isFirstFrame
      ? "Scene opens"
      : isLastFrame
        ? "Scene concludes"
        : "Action continues",
  };

  return mockDescription;
}

/**
 * Build prompt for AI frame description
 */
function buildFramePrompt(params: {
  sceneScript: string;
  sceneDescription: string;
  framePosition: number;
  totalFrames: number;
  shotType: string;
  isFirstFrame: boolean;
  isLastFrame: boolean;
  styleStack?: Json;
  characters: string[];
  settings: string[];
}): string {
  const {
    sceneScript,
    sceneDescription,
    framePosition,
    totalFrames,
    shotType,
    isFirstFrame,
    isLastFrame,
    styleStack,
    characters,
    settings,
  } = params;

  let prompt = `Generate a detailed visual description for frame ${framePosition + 1} of ${totalFrames} in this scene.

Scene Context: ${sceneDescription}
Script Excerpt: ${sceneScript.slice(0, 500)}

Frame Requirements:
- Shot Type: ${shotType}
- Position: ${isFirstFrame ? "Opening frame" : isLastFrame ? "Closing frame" : `Frame ${framePosition + 1} of ${totalFrames}`}
`;

  if (characters.length > 0) {
    prompt += `- Characters in scene: ${characters.join(", ")}\n`;
  }

  if (settings.length > 0) {
    prompt += `- Settings: ${settings.join(", ")}\n`;
  }

  if (styleStack) {
    prompt += `- Visual style: ${JSON.stringify(styleStack)}\n`;
  }

  prompt += `
Provide a cinematic frame description including:
1. Detailed visual composition
2. Camera angle and movement
3. Lighting and atmosphere
4. Character positioning and expressions
5. Environmental details
6. Any relevant action or movement

Format as a single paragraph suitable for a storyboard.`;

  return prompt;
}

/**
 * Get shot progression for a scene
 */
function getShotProgression(frameCount: number): string[] {
  const basicProgression = [
    "wide shot",
    "medium shot",
    "close-up",
    "medium shot",
    "wide shot",
  ];

  if (frameCount <= 3) {
    return ["wide shot", "medium shot", "close-up"].slice(0, frameCount);
  }

  if (frameCount <= 5) {
    return basicProgression.slice(0, frameCount);
  }

  // For more than 5 frames, cycle through with variations
  const extendedProgression: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    const baseShot = basicProgression[i % basicProgression.length];
    if (i >= 5) {
      // Add variations for additional frames
      const variations = [
        "over-the-shoulder shot",
        "tracking shot",
        "reaction shot",
        "insert shot",
      ];
      extendedProgression.push(variations[i % variations.length]);
    } else {
      extendedProgression.push(baseShot);
    }
  }

  return extendedProgression;
}

/**
 * Generate mock description (placeholder for actual AI)
 */
function generateMockDescription(params: {
  sceneDescription: string;
  framePosition: number;
  totalFrames: number;
  shotType: string;
  characters: string[];
  settings: string[];
}): string {
  const {
    sceneDescription,
    framePosition,
    totalFrames,
    shotType,
    characters,
    settings,
  } = params;

  const position =
    framePosition === 0
      ? "opens with"
      : framePosition === totalFrames - 1
        ? "concludes with"
        : "continues with";

  let description = `The frame ${position} a ${shotType} `;

  if (settings.length > 0) {
    description += `of ${settings[0]} `;
  }

  if (characters.length > 0) {
    description += `featuring ${characters.slice(0, 2).join(" and ")} `;
  }

  description += `${sceneDescription.slice(0, 100)}. `;
  description += `The composition emphasizes the dramatic tension of the moment, `;
  description += `with careful attention to visual storytelling and emotional impact.`;

  return description;
}

/**
 * Get mock lighting based on frame position
 */
function getMockLighting(framePosition: number, _totalFrames: number): string {
  const lightingOptions = [
    "natural daylight",
    "soft morning light",
    "dramatic shadows",
    "golden hour",
    "moody low-key lighting",
    "bright high-key lighting",
    "atmospheric fog",
  ];

  return lightingOptions[framePosition % lightingOptions.length];
}

/**
 * Get mock mood from scene description
 */
function getMockMood(sceneDescription: string): string {
  const description = sceneDescription.toLowerCase();

  if (description.includes("happy") || description.includes("joy"))
    return "joyful";
  if (description.includes("sad") || description.includes("cry"))
    return "melancholic";
  if (description.includes("fight") || description.includes("action"))
    return "intense";
  if (description.includes("love") || description.includes("romantic"))
    return "romantic";
  if (description.includes("scary") || description.includes("horror"))
    return "suspenseful";
  if (description.includes("mystery") || description.includes("detective"))
    return "mysterious";

  return "neutral";
}

/**
 * Get mock color palette from style stack
 */
function getMockColorPalette(styleStack?: Json): string[] {
  if (!styleStack) {
    return ["#1a1a1a", "#ffffff", "#808080"];
  }

  // Try to extract colors from style stack if it exists
  if (typeof styleStack === "object" && styleStack !== null) {
    const style = styleStack as Record<string, unknown>;
    if (style.colors && Array.isArray(style.colors)) {
      return style.colors as string[];
    }
  }

  // Default palettes
  const palettes = [
    ["#2c3e50", "#e74c3c", "#ecf0f1"], // Dark & Red
    ["#16a085", "#f39c12", "#34495e"], // Teal & Orange
    ["#8e44ad", "#3498db", "#95a5a6"], // Purple & Blue
    ["#d35400", "#c0392b", "#7f8c8d"], // Orange & Red
  ];

  return palettes[Math.floor(Math.random() * palettes.length)];
}
