/**
 * Type definitions for progressive script analysis
 *
 * Progressive analysis builds up Scene data across 5 phases.
 * The Scene type has optional fields that get populated as analysis progresses.
 */

import type { Scene } from '@/lib/ai/scene-analysis.schema';

// Re-export Scene as the single source of truth for scene data
export type { Scene };
