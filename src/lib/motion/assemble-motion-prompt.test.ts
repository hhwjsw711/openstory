import { describe, expect, it } from 'bun:test';
import { IMAGE_TO_VIDEO_MODELS } from '../ai/models';
import type { MotionPrompt } from '../ai/scene-analysis.schema';
import { assembleMotionPrompt } from './assemble-motion-prompt';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseComponents: MotionPrompt['components'] = {
  cameraMovement: 'slow dolly forward',
  startPosition: 'medium shot of character at desk',
  endPosition: 'close-up on character face',
  durationSeconds: 8,
  speed: 'slow',
  smoothness: 'smooth',
  subjectTracking: 'Maintains focus on character face',
  equipment: 'Steadicam',
};

const baseParameters: MotionPrompt['parameters'] = {
  durationSeconds: 8,
  fps: 30,
  motionAmount: 'medium',
  cameraControl: { pan: 0, tilt: 0, zoom: 1.2, movement: 'forward' },
};

const dialogueWithTone: NonNullable<MotionPrompt['dialogue']> = {
  presence: true,
  lines: [
    {
      character: 'Sarah',
      line: 'We need to reconsider the entire approach.',
      tone: 'firm commanding',
    },
    {
      character: 'James',
      line: "I couldn't agree more.",
      tone: 'soft resigned',
    },
  ],
};

const audioData: NonNullable<MotionPrompt['audio']> = {
  ambientSound: 'quiet office hum with keyboard clicks',
  soundEffects: ['chair scrape', 'paper rustling'],
};

const fullPromptText =
  'Steadicam slow dolly forward from medium shot to close-up.\n\nSarah speaks firmly while gesturing. James nods in agreement.\n\nSubtle office sounds, papers flutter.';

function makeMotionPrompt(overrides: Partial<MotionPrompt> = {}): MotionPrompt {
  return {
    fullPrompt: fullPromptText,
    components: baseComponents,
    parameters: baseParameters,
    dialogue: dialogueWithTone,
    audio: audioData,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Kling v3 Pro (audio-capable — default model)
// ---------------------------------------------------------------------------

describe('assembleMotionPrompt', () => {
  describe('Kling v3 Pro (audio)', () => {
    const modelConfig = IMAGE_TO_VIDEO_MODELS.kling_v3_pro;

    it('starts with the fullPrompt as the base', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toStartWith(fullPromptText);
    });

    it('appends character labels with tone and dialogue text', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toContain(
        '[Sarah, firm commanding]: "We need to reconsider the entire approach."'
      );
      expect(result).toContain(
        '[James, soft resigned]: "I couldn\'t agree more."'
      );
    });

    it('uses temporal markers between dialogue lines', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toContain('Immediately,');
    });

    it('appends ambient sound descriptions', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toContain('Ambient sounds:');
      expect(result).toContain('quiet office hum');
      expect(result).toContain('chair scrape');
    });

    it('omits dialogue section when not present', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({
          dialogue: { presence: false, lines: [] },
        }),
        modelConfig,
      });

      expect(result).not.toContain('[Sarah');
      // Still has fullPrompt + audio
      expect(result).toStartWith(fullPromptText);
      expect(result).toContain('Ambient sounds:');
    });

    it('omits audio section when no audio data', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({ audio: undefined }),
        modelConfig,
      });

      expect(result).not.toContain('Ambient sounds:');
      // Still has fullPrompt + dialogue
      expect(result).toContain('[Sarah');
    });
  });

  // ---------------------------------------------------------------------------
  // Kling v3 Pro no audio
  // ---------------------------------------------------------------------------

  describe('Kling v3 Pro no audio', () => {
    const modelConfig = IMAGE_TO_VIDEO_MODELS.kling_v3_pro_no_audio;

    it('returns fullPrompt only for non-audio model', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toBe(fullPromptText);
    });
  });

  // ---------------------------------------------------------------------------
  // Google Veo 3.1 (audio-capable)
  // ---------------------------------------------------------------------------

  describe('Google Veo 3.1 (audio)', () => {
    const modelConfig = IMAGE_TO_VIDEO_MODELS.veo3_1;

    it('starts with fullPrompt as the base', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toStartWith(fullPromptText);
    });

    it('appends dialogue as natural narrative with inline quotes', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toContain(
        'Sarah says in a firm commanding voice, "We need to reconsider the entire approach."'
      );
      expect(result).toContain('James says in a soft resigned voice,');
    });

    it('appends Audio: section with ambient and SFX', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toContain('Audio:');
      expect(result).toContain('quiet office hum');
      expect(result).toContain('chair scrape');
    });

    it('omits Audio: section when no audio data', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({ audio: undefined }),
        modelConfig,
      });

      expect(result).not.toContain('Audio:');
    });

    it('omits dialogue when not present', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({
          dialogue: { presence: false, lines: [] },
        }),
        modelConfig,
      });

      expect(result).not.toContain('Sarah says');
      expect(result).toStartWith(fullPromptText);
    });
  });

  // ---------------------------------------------------------------------------
  // Non-audio models (Seedance, Wan, Grok)
  // ---------------------------------------------------------------------------

  describe('Seedance v1 Pro (no audio)', () => {
    const modelConfig = IMAGE_TO_VIDEO_MODELS.seedance_v1_pro;

    it('returns fullPrompt without dialogue or audio enrichment', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toBe(fullPromptText);
    });
  });

  describe('Grok Imagine Video (no audio)', () => {
    const modelConfig = IMAGE_TO_VIDEO_MODELS.grok_imagine_video;

    it('returns fullPrompt for non-audio model', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toBe(fullPromptText);
    });
  });

  describe('Wan 2.6 Flash (no audio)', () => {
    const modelConfig = IMAGE_TO_VIDEO_MODELS.wan_v2_6_flash;

    it('returns fullPrompt for non-audio model', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toBe(fullPromptText);
    });
  });

  // ---------------------------------------------------------------------------
  // OpenAI Sora 2 (audio-capable, uses Veo-style)
  // ---------------------------------------------------------------------------

  describe('OpenAI Sora 2 (audio)', () => {
    const modelConfig = IMAGE_TO_VIDEO_MODELS.sora_2;

    it('uses Veo-style natural narrative with dialogue', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt(),
        modelConfig,
      });

      expect(result).toStartWith(fullPromptText);
      expect(result).toContain('Sarah says in a firm commanding voice');
      expect(result).toContain('Audio:');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles dialogue lines without tone', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({
          dialogue: {
            presence: true,
            lines: [{ character: 'Sarah', line: 'Hello.', tone: '' }],
          },
        }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.kling_v3_pro,
      });

      // No tone → no tone suffix in Kling label
      expect(result).toContain('[Sarah]: "Hello."');
    });

    it('handles narrator (empty character)', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({
          dialogue: {
            presence: true,
            lines: [
              { character: '', line: 'It was a dark night.', tone: 'somber' },
            ],
          },
        }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.kling_v3_pro,
      });

      expect(result).toContain('[Narrator, somber]: "It was a dark night."');
    });

    it('handles audio with only ambient sound', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({
          audio: { ambientSound: 'rain on windows', soundEffects: [] },
        }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.veo3_1,
      });

      expect(result).toContain('Audio: rain on windows');
    });

    it('handles audio with only sound effects', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({
          audio: { ambientSound: '', soundEffects: ['door slam'] },
        }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.veo3_1,
      });

      expect(result).toContain('Audio: door slam');
    });

    it('handles empty audio (no ambient, no SFX)', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({
          audio: { ambientSound: '', soundEffects: [] },
        }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.veo3_1,
      });

      // No Audio: section when both are empty
      expect(result).not.toContain('Audio:');
    });
  });

  // ---------------------------------------------------------------------------
  // Prompt length truncation
  // ---------------------------------------------------------------------------

  describe('prompt length truncation', () => {
    // Build a long fullPrompt with multiple paragraphs
    const para1 = 'Camera dolly forward. ' + 'x'.repeat(300); // ~322 chars
    const para2 = 'Sarah speaks firmly. ' + 'x'.repeat(300); // ~321 chars
    const para3 = 'Rain falls softly. ' + 'x'.repeat(300); // ~319 chars
    const longFullPrompt = [para1, para2, para3].join('\n\n');

    it('Wan v2.6 truncates prompt exceeding 800 chars (paragraph-aware)', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({ fullPrompt: longFullPrompt }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.wan_v2_6_flash,
      });

      expect(result.length).toBeLessThanOrEqual(800);
      // Should keep para1 + para2 (322 + 2 + 321 = 645) but drop para3
      expect(result).toContain(para1);
      expect(result).toContain(para2);
      expect(result).not.toContain(para3);
    });

    it('Wan v2.6 preserves prompt under 800 chars', () => {
      const shortPrompt = 'Camera pushes in slowly as dust motes drift.';
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({ fullPrompt: shortPrompt }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.wan_v2_6_flash,
      });

      expect(result).toBe(shortPrompt);
    });

    it('Kling v3 Pro truncates assembled prompt exceeding 2500 chars', () => {
      // Kling is audio-capable, so dialogue + audio get appended (~220 chars)
      // Base must be long enough that base + dialogue + audio > 2500
      const longBase = 'Camera tracks forward. ' + 'x'.repeat(2400);
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({ fullPrompt: longBase }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.kling_v3_pro,
      });

      expect(result.length).toBeLessThanOrEqual(2500);
      // Dialogue and audio sections should be dropped to fit
      expect(result).not.toContain('[Sarah');
      expect(result).not.toContain('Ambient sounds:');
    });

    it('Veo 3.1 passes through long prompts (20000 char limit)', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({ fullPrompt: longFullPrompt }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.veo3_1,
      });

      // Well under 20000, should include everything
      expect(result).toContain(para1);
      expect(result).toContain('Sarah says');
      expect(result).toContain('Audio:');
    });

    it('Seedance passes through untruncated (no limit)', () => {
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({ fullPrompt: longFullPrompt }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.seedance_v1_pro,
      });

      expect(result).toBe(longFullPrompt);
    });

    it('falls back to hard slice when first paragraph exceeds limit', () => {
      const giantParagraph = 'x'.repeat(1000); // single paragraph, no \n\n
      const result = assembleMotionPrompt({
        motionPrompt: makeMotionPrompt({ fullPrompt: giantParagraph }),
        modelConfig: IMAGE_TO_VIDEO_MODELS.wan_v2_6_flash,
      });

      expect(result.length).toBe(800);
      expect(result).toEndWith('...');
    });
  });
});
