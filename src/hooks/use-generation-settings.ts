import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  getCompatibleModel,
  isValidImageToVideoModel,
  isValidTextToImageModel,
  type ImageToVideoModel,
  type TextToImageModel,
} from '@/lib/ai/models';
import {
  ANALYSIS_MODEL_IDS,
  DEFAULT_ANALYSIS_MODEL,
  type AnalysisModelId,
} from '@/lib/ai/models.config';
import {
  DEFAULT_ASPECT_RATIO,
  type AspectRatio,
} from '@/lib/constants/aspect-ratios';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'velro:generation-settings:v1';

type GenerationSettings = {
  aspectRatio: AspectRatio;
  analysisModels: AnalysisModelId[];
  imageModel: TextToImageModel;
  motionModel: ImageToVideoModel;
  autoGenerateMotion: boolean;
};

const DEFAULT_SETTINGS: GenerationSettings = {
  aspectRatio: DEFAULT_ASPECT_RATIO,
  analysisModels: [DEFAULT_ANALYSIS_MODEL],
  imageModel: DEFAULT_IMAGE_MODEL,
  motionModel: DEFAULT_VIDEO_MODEL,
  autoGenerateMotion: false,
};

/**
 * Validates aspect ratio value
 */
function isValidAspectRatio(value: unknown): value is AspectRatio {
  return (
    typeof value === 'string' &&
    (value === '16:9' || value === '9:16' || value === '1:1')
  );
}

/**
 * Validates analysis model IDs array
 */
function isValidAnalysisModels(value: unknown): value is AnalysisModelId[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return value.every(
    (id) =>
      typeof id === 'string' && ANALYSIS_MODEL_IDS.some((model) => model === id)
  );
}

/**
 * Loads settings from localStorage with validation
 */
function loadSettings(): GenerationSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored) as unknown;

    // Validate structure
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('aspectRatio' in parsed) ||
      !('analysisModels' in parsed) ||
      !('imageModel' in parsed) ||
      !('motionModel' in parsed) ||
      !('autoGenerateMotion' in parsed)
    ) {
      console.warn(
        '[useGenerationSettings] Invalid settings structure, using defaults'
      );
      return DEFAULT_SETTINGS;
    }

    // Validate and sanitize each field
    const aspectRatio = isValidAspectRatio(parsed.aspectRatio)
      ? parsed.aspectRatio
      : DEFAULT_ASPECT_RATIO;

    const analysisModels = isValidAnalysisModels(parsed.analysisModels)
      ? parsed.analysisModels
      : [DEFAULT_ANALYSIS_MODEL];

    const imageModel = isValidTextToImageModel(parsed.imageModel)
      ? parsed.imageModel
      : DEFAULT_IMAGE_MODEL;

    const rawMotionModel = isValidImageToVideoModel(parsed.motionModel)
      ? parsed.motionModel
      : DEFAULT_VIDEO_MODEL;

    // Ensure motion model is compatible with aspect ratio
    const motionModel = getCompatibleModel(rawMotionModel, aspectRatio);

    const autoGenerateMotion =
      typeof parsed.autoGenerateMotion === 'boolean'
        ? parsed.autoGenerateMotion
        : false;

    return {
      aspectRatio,
      analysisModels,
      imageModel,
      motionModel,
      autoGenerateMotion,
    };
  } catch (error) {
    console.warn(
      '[useGenerationSettings] Failed to load settings from localStorage:',
      error
    );
    return DEFAULT_SETTINGS;
  }
}

/**
 * Saves settings to localStorage
 */
function saveSettings(settings: GenerationSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn(
      '[useGenerationSettings] Failed to save settings to localStorage:',
      error
    );
  }
}

/**
 * Hook for managing generation settings with localStorage persistence
 *
 * @returns Object with current settings and save function
 */
export function useGenerationSettings() {
  // Always initialize with defaults to prevent hydration mismatch
  // localStorage values are loaded in useEffect after mount
  const [settings, setSettings] =
    useState<GenerationSettings>(DEFAULT_SETTINGS);

  // Load settings on mount (client-side only)
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
  }, []);

  /**
   * Save settings to localStorage and update state
   * Auto-switches motion model if incompatible with new aspect ratio
   */
  const save = useCallback((newSettings: Partial<GenerationSettings>) => {
    setSettings((prev) => {
      let updated = { ...prev, ...newSettings };

      // If aspect ratio is changing, ensure motion model is compatible
      if (
        newSettings.aspectRatio &&
        newSettings.aspectRatio !== prev.aspectRatio
      ) {
        const compatibleModel = getCompatibleModel(
          updated.motionModel,
          newSettings.aspectRatio
        );
        if (compatibleModel !== updated.motionModel) {
          updated = { ...updated, motionModel: compatibleModel };
        }
      }

      saveSettings(updated);
      return updated;
    });
  }, []);

  /**
   * Reset settings to defaults
   */
  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    save,
    reset,
  };
}
