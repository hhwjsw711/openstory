/**
 * Style and Script Combiner for FAL.AI
 * Combines style stack configurations with script content for optimized prompts
 */

import { optimizePromptForModel } from "@/lib/ai/model-prompt-strategy";
import type { Style } from "@/types/database";

export interface StyleScriptCombination {
  originalScript: string;
  enhancedPrompt: string;
  optimizedPrompt: string;
  styleElements: string[];
  modelSpecificEnhancements: string[];
  styleId?: string;
  styleName?: string;
}

export interface StyleConfig {
  base: {
    mood?: string;
    lighting?: string;
    color_palette?: string;
    camera?: string;
    composition?: string;
    texture?: string;
    environment?: string;
  };
  models?: Record<
    string,
    {
      additional_prompt?: string;
      negative_prompt?: string;
      guidance_scale?: number;
      steps?: number;
    }
  >;
}

/**
 * Combines style configuration with script content
 */
export function combineStyleWithScript(
  script: string,
  style: Style | undefined,
  modelId: string,
): StyleScriptCombination {
  const styleElements: string[] = [];
  const modelSpecificEnhancements: string[] = [];
  let enhancedPrompt = script;

  if (style?.config) {
    try {
      const styleConfig = style.config as unknown as StyleConfig;
      const baseStyle = styleConfig.base;

      // Extract style elements
      if (baseStyle.mood) styleElements.push(baseStyle.mood);
      if (baseStyle.lighting) styleElements.push(baseStyle.lighting);
      if (baseStyle.color_palette) styleElements.push(baseStyle.color_palette);
      if (baseStyle.camera) styleElements.push(baseStyle.camera);
      if (baseStyle.composition) styleElements.push(baseStyle.composition);
      if (baseStyle.texture) styleElements.push(baseStyle.texture);
      if (baseStyle.environment) styleElements.push(baseStyle.environment);

      // Combine script with style elements
      if (styleElements.length > 0) {
        enhancedPrompt = `${script}, ${styleElements.join(", ")}`;
      }

      // Add model-specific enhancements
      if (styleConfig.models?.[modelId]) {
        const modelStyle = styleConfig.models[modelId];
        if (modelStyle.additional_prompt) {
          modelSpecificEnhancements.push(modelStyle.additional_prompt);
          enhancedPrompt = `${enhancedPrompt}, ${modelStyle.additional_prompt}`;
        }
      }
    } catch (error) {
      console.warn(
        "[StyleScriptCombiner] Failed to parse style config:",
        error,
      );
    }
  }

  // Apply model-specific prompt optimization
  const optimizedPrompt = optimizePromptForModel(modelId, enhancedPrompt);

  return {
    originalScript: script,
    enhancedPrompt,
    optimizedPrompt,
    styleElements,
    modelSpecificEnhancements,
    styleId: style?.id,
    styleName: style?.name,
  };
}

/**
 * Gets style-specific technical parameters for a model
 */
export function getStyleTechnicalParams(
  style: Style | undefined,
  modelId: string,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  if (style?.config) {
    try {
      const styleConfig = style.config as unknown as StyleConfig;

      if (styleConfig.models?.[modelId]) {
        const modelStyle = styleConfig.models[modelId];

        if (modelStyle.guidance_scale !== undefined) {
          params.guidance_scale = modelStyle.guidance_scale;
        }

        if (modelStyle.steps !== undefined) {
          params.steps = modelStyle.steps;
        }

        if (modelStyle.negative_prompt) {
          params.negative_prompt = modelStyle.negative_prompt;
        }
      }
    } catch (error) {
      console.warn(
        "[StyleScriptCombiner] Failed to extract technical params:",
        error,
      );
    }
  }

  return params;
}

/**
 * Validates style compatibility with model
 */
export function validateStyleModelCompatibility(
  style: Style | undefined,
  modelId: string,
): {
  compatible: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (!style) {
    return { compatible: true, warnings, recommendations };
  }

  if (style.config) {
    try {
      const styleConfig = style.config as unknown as StyleConfig;
      const baseStyle = styleConfig.base;

      // Check for complex style elements that might not work well with fast models
      const fastModels = ["fal-ai/flux/schnell", "fal-ai/fast-lightning-sdxl"];
      if (fastModels.includes(modelId)) {
        if (
          baseStyle.lighting?.includes("dramatic") ||
          baseStyle.lighting?.includes("cinematic")
        ) {
          warnings.push("Fast models may not handle complex lighting well");
          recommendations.push(
            "Consider using a more capable model for dramatic lighting",
          );
        }

        if (
          baseStyle.composition?.includes("rule of thirds") ||
          baseStyle.composition?.includes("advanced")
        ) {
          warnings.push("Fast models have limited composition capabilities");
          recommendations.push(
            "Simplify composition requirements for fast models",
          );
        }
      }

      // Check for model-specific configurations
      if (styleConfig.models?.[modelId]) {
        const modelStyle = styleConfig.models[modelId];

        if (modelStyle.guidance_scale && modelStyle.guidance_scale > 10) {
          warnings.push("High guidance scale may cause over-saturation");
          recommendations.push(
            "Consider reducing guidance scale for better results",
          );
        }

        if (modelStyle.steps && modelStyle.steps > 40) {
          warnings.push(
            "High step count will increase generation time and cost",
          );
          recommendations.push(
            "Consider reducing steps for faster, more cost-effective generation",
          );
        }
      }
    } catch (_error) {
      warnings.push("Failed to validate style configuration");
      recommendations.push("Check style configuration format");
    }
  }

  return {
    compatible: warnings.length === 0,
    warnings,
    recommendations,
  };
}

/**
 * Gets style preview information for UI display
 */
export function getStylePreview(style: Style | undefined): {
  name: string;
  description: string;
  category: string;
  tags: string[];
  keyElements: string[];
} {
  if (!style) {
    return {
      name: "No Style",
      description: "Generate without style modifications",
      category: "none",
      tags: [],
      keyElements: [],
    };
  }

  const keyElements: string[] = [];

  if (style.config) {
    try {
      const styleConfig = style.config as unknown as StyleConfig;
      const baseStyle = styleConfig.base;

      if (baseStyle.mood) keyElements.push(`Mood: ${baseStyle.mood}`);
      if (baseStyle.lighting)
        keyElements.push(`Lighting: ${baseStyle.lighting}`);
      if (baseStyle.color_palette)
        keyElements.push(`Colors: ${baseStyle.color_palette}`);
      if (baseStyle.camera) keyElements.push(`Camera: ${baseStyle.camera}`);
    } catch (error) {
      console.warn(
        "[StyleScriptCombiner] Failed to parse style for preview:",
        error,
      );
    }
  }

  return {
    name: style.name,
    description: style.description || "Custom style configuration",
    category: style.category || "custom",
    tags: style.tags || [],
    keyElements,
  };
}
