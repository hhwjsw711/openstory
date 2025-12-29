import type { SceneAnalysis } from './scene-analysis.schema';

export const sceneAnalysisExample: SceneAnalysis = {
  status: 'success',
  projectMetadata: {
    title: "Project title from script or 'Untitled'",
    aspectRatio: '16:9',
    generatedAt: 'ISO 8601 timestamp',
  },

  characterBible: [
    {
      characterId: 'char_001',
      name: 'Character Name',
      age: 'age',
      gender: 'gender',
      ethnicity: 'ethnicity',
      physicalDescription: 'Complete physical description for prompts',
      standardClothing: 'Complete clothing description for prompts',
      distinguishingFeatures: 'Unique identifiers',
      consistencyTag: 'Short tag for continuity',
    },
  ],

  scenes: [
    {
      sceneId: 'scene_001',
      sceneNumber: 1,

      originalScript: {
        extract: "Exact text from user's original script for this scene",
        dialogue: [
          {
            character: 'CHARACTER NAME or null if unknown',
            line: 'Exact dialogue text from user script',
          },
        ],
      },

      metadata: {
        title: 'Scene Title',
        durationSeconds: 6,
        location: 'Specific location',
        timeOfDay: 'Exact time',
        storyBeat: 'What happens narratively',
      },

      prompts: {
        visual: {
          fullPrompt:
            'Complete 200-400 word self-contained visual description combining all components with director style applied. Include: shot type, all subjects with complete descriptions, complete environment, lighting details, camera specs, composition approach, style elements, technical specifications, and atmospheric details.',
          negativePrompt:
            'blurry, low quality, distorted, amateur, soft focus, watermark, text, signature',
          components: {
            sceneDescription: 'What is visible in this frame',
            subject: 'Complete character/object descriptions',
            environment: 'Complete setting details',
            lighting: 'Light sources, quality, color, direction',
            camera: 'Shot type, angle, lens, technical specs',
            composition: 'Framing approach and spatial arrangement',
            style: 'Director aesthetic and color grading',
            technical: 'Camera equipment and settings',
            atmosphere: 'Mood, textures, emotional tone',
          },
        },

        motion: {
          fullPrompt:
            'Complete 100-150 word camera movement description. Include: camera equipment, movement type, start position, end position, speed, smoothness, what stays in frame, duration, and emotional purpose of movement.',
          components: {
            cameraMovement: 'Type of movement (static, dolly, pan, etc.)',
            startPosition: 'Starting frame description',
            endPosition: 'Ending frame description',
            durationSeconds: 6,
            speed: 'Slow/medium/fast with specifics',
            smoothness: 'Quality of movement (glass-smooth, organic, etc.)',
            subjectTracking: 'What remains in frame throughout',
            equipment: 'Camera rig and mounting',
          },
          parameters: {
            durationSeconds: 6,
            fps: 24,
            motionAmount: 'low',
            cameraControl: {
              pan: 0,
              tilt: 0,
              zoom: 0,
              movement: 'static',
            },
          },
        },
      },

      audioDesign: {
        music: {
          presence: 'none',
          style: 'Genre if present',
          mood: 'Emotional quality if present',
          rationale: 'Why this music choice',
        },
        soundEffects: [
          {
            sfxId: 'sfx_001',
            type: 'ambient',
            description: 'Sound effect description',
            timing: 'When it occurs (timestamp or continuous)',
            volume: 'low',
            spatialPosition: 'surround',
          },
        ],
        dialogue: {
          presence: false,
          lines: [],
        },
        ambient: {
          roomTone: 'Environmental base sound',
          atmosphere: 'Overall sonic environment',
        },
      },

      continuity: {
        characterTags: ['Character: consistency description'],
        environmentTag: 'Environment consistency description',
        colorPalette: 'Color palette description',
        lightingSetup: 'Lighting consistency notes',
        styleTag: 'Style consistency notes',
      },

      sourceImageUrl: 'https://example.com/image.jpg',
    },
  ],
};
