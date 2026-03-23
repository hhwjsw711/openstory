/**
 * Reducer for managing real-time generation stream state.
 * Handles events from the Upstash Realtime channel during storyboard generation.
 */

type FrameStatus = 'pending' | 'generating' | 'completed' | 'failed';

type StreamingScene = {
  sceneId: string;
  sceneNumber: number;
  title: string;
  scriptExtract: string;
  durationSeconds: number;
};

type StreamingFrame = {
  frameId: string;
  sceneId: string;
  orderIndex: number;
  imageStatus: FrameStatus;
  videoStatus: FrameStatus;
  thumbnailUrl?: string;
  videoUrl?: string;
};

type TalentMatch = {
  characterId: string;
  characterName: string;
  talentId: string;
  talentName: string;
};

type LocationMatch = {
  locationId: string;
  libraryLocationId: string;
  libraryLocationName: string;
  referenceImageUrl: string;
  description?: string;
};

type UnusedTalent = {
  ids: string[];
  names: string[];
};

export type GenerationPhase = {
  phase: number;
  phaseName: string;
  shortName: string;
  status: 'pending' | 'active' | 'completed';
};

export type GenerationStreamState = {
  /** Current generation phase (1-7) */
  currentPhase: number;
  /** All phases with their status */
  phases: GenerationPhase[];
  /** Scenes received during streaming */
  scenes: StreamingScene[];
  /** Frames with their generation status */
  frames: Map<string, StreamingFrame>;
  /** Whether generation is complete */
  isComplete: boolean;
  /** Whether generation failed */
  isFailed: boolean;
  /** Error message if generation failed */
  error?: string;
  /** Talent matched to characters during generation */
  talentMatches: TalentMatch[];
  /** Location matched during generation */
  locationMatches: LocationMatch[];
  /** Talent that weren't matched to any character */
  unusedTalent: UnusedTalent | null;
};

export type GenerationStreamAction =
  | {
      type: 'PHASE_START';
      payload: { phase: number; phaseName: string };
    }
  | { type: 'PHASE_COMPLETE'; payload: { phase: number } }
  | { type: 'SCENE_NEW'; payload: StreamingScene }
  | { type: 'SCENE_UPDATED'; payload: StreamingScene }
  | {
      type: 'FRAME_CREATED';
      payload: { frameId: string; sceneId: string; orderIndex: number };
    }
  | {
      type: 'IMAGE_PROGRESS';
      payload: { frameId: string; status: FrameStatus; thumbnailUrl?: string };
    }
  | {
      type: 'VIDEO_PROGRESS';
      payload: { frameId: string; status: FrameStatus; videoUrl?: string };
    }
  | { type: 'COMPLETE'; payload: { sequenceId: string } }
  | { type: 'FAILED'; payload: { message: string } }
  | { type: 'ERROR'; payload: { message: string; phase?: number } }
  | { type: 'TALENT_MATCHED'; payload: { matches: TalentMatch[] } }
  | {
      type: 'TALENT_UNMATCHED';
      payload: { unusedTalentIds: string[]; unusedTalentNames: string[] };
    }
  | { type: 'LOCATION_MATCHED'; payload: { matches: LocationMatch[] } }
  | { type: 'RESET' };

const PHASES = [
  { name: 'Analyzing script…', shortName: 'Script' },
  { name: 'Casting characters & locations…', shortName: 'Casting' },
  { name: 'Generating references & prompts…', shortName: 'Visual Prompts' },
  { name: 'Generating images…', shortName: 'Images' },
  { name: 'Writing motion prompts…', shortName: 'Motion Prompts' },
  { name: 'Composing music…', shortName: 'Music Prompts' },
] as const;

export type GenerationPhaseConfig = {
  autoGenerateMotion: boolean;
  autoGenerateMusic: boolean;
};

function getPhase7Label(config: GenerationPhaseConfig): {
  name: string;
  shortName: string;
} {
  const { autoGenerateMotion, autoGenerateMusic } = config;
  if (autoGenerateMotion && autoGenerateMusic) {
    return { name: 'Generating motion & music…', shortName: 'Music & Motion' };
  }
  if (autoGenerateMotion) {
    return { name: 'Generating motion…', shortName: 'Motion' };
  }
  return { name: 'Generating music…', shortName: 'Music' };
}

export function createInitialState(
  config?: GenerationPhaseConfig
): GenerationStreamState {
  const includePhase7 = config?.autoGenerateMotion || config?.autoGenerateMusic;
  const basePhaseDefs = PHASES;

  const phases: GenerationPhase[] = basePhaseDefs.map((p, i) => ({
    phase: i + 1,
    phaseName: p.name,
    shortName: p.shortName,
    status: 'pending' as const,
  }));

  if (includePhase7 && config) {
    const label = getPhase7Label(config);
    phases.push({
      phase: 7,
      phaseName: label.name,
      shortName: label.shortName,
      status: 'pending',
    });
  }

  return {
    currentPhase: 0,
    phases,
    scenes: [],
    frames: new Map(),
    isComplete: false,
    isFailed: false,
    talentMatches: [],
    locationMatches: [],
    unusedTalent: null,
  };
}

export const initialGenerationStreamState: GenerationStreamState =
  createInitialState();

export function generationStreamReducer(
  state: GenerationStreamState,
  action: GenerationStreamAction
): GenerationStreamState {
  switch (action.type) {
    case 'PHASE_START': {
      const { phase, phaseName } = action.payload;

      // Ignore backwards phase transitions (prevents flickering from out-of-order events)
      if (phase < state.currentPhase) {
        return state;
      }

      return {
        ...state,
        currentPhase: phase,
        phases: state.phases.map((p) =>
          p.phase === phase
            ? { ...p, phaseName, status: 'active' }
            : p.phase < phase
              ? { ...p, status: 'completed' }
              : p
        ),
      };
    }

    case 'PHASE_COMPLETE': {
      const { phase } = action.payload;
      return {
        ...state,
        phases: state.phases.map((p) =>
          p.phase === phase ? { ...p, status: 'completed' } : p
        ),
      };
    }

    case 'SCENE_NEW': {
      // Check if scene already exists to avoid duplicates
      const exists = state.scenes.some(
        (s) => s.sceneId === action.payload.sceneId
      );
      if (exists) return state;

      return {
        ...state,
        scenes: [...state.scenes, action.payload],
      };
    }

    case 'SCENE_UPDATED': {
      const idx = state.scenes.findIndex(
        (s) => s.sceneId === action.payload.sceneId
      );
      if (idx === -1) return state;
      const updated = [...state.scenes];
      updated[idx] = action.payload;
      return { ...state, scenes: updated };
    }

    case 'FRAME_CREATED': {
      const { frameId, sceneId, orderIndex } = action.payload;
      const newFrames = new Map(state.frames);
      newFrames.set(frameId, {
        frameId,
        sceneId,
        orderIndex,
        imageStatus: 'pending',
        videoStatus: 'pending',
      });
      return {
        ...state,
        frames: newFrames,
      };
    }

    case 'IMAGE_PROGRESS': {
      const { frameId, status, thumbnailUrl } = action.payload;
      const frame = state.frames.get(frameId);
      if (!frame) return state;

      const newFrames = new Map(state.frames);
      newFrames.set(frameId, {
        ...frame,
        imageStatus: status,
        thumbnailUrl: thumbnailUrl ?? frame.thumbnailUrl,
      });
      return {
        ...state,
        frames: newFrames,
      };
    }

    case 'VIDEO_PROGRESS': {
      const { frameId, status, videoUrl } = action.payload;
      const frame = state.frames.get(frameId);
      if (!frame) return state;

      const newFrames = new Map(state.frames);
      newFrames.set(frameId, {
        ...frame,
        videoStatus: status,
        videoUrl: videoUrl ?? frame.videoUrl,
      });
      return {
        ...state,
        frames: newFrames,
      };
    }

    case 'COMPLETE':
      return {
        ...state,
        isComplete: true,
        currentPhase: state.phases.length + 1, // Beyond last phase so all marked complete
        phases: state.phases.map((p) => ({ ...p, status: 'completed' })),
      };

    case 'FAILED':
      return {
        ...state,
        isFailed: true,
        error: action.payload.message,
      };

    case 'ERROR':
      return {
        ...state,
        error: action.payload.message,
      };

    case 'TALENT_MATCHED':
      return {
        ...state,
        talentMatches: action.payload.matches,
      };

    case 'TALENT_UNMATCHED':
      return {
        ...state,
        unusedTalent: {
          ids: action.payload.unusedTalentIds,
          names: action.payload.unusedTalentNames,
        },
      };

    case 'LOCATION_MATCHED':
      return {
        ...state,
        locationMatches: action.payload.matches,
      };

    case 'RESET':
      return initialGenerationStreamState;

    default:
      return state;
  }
}
