import { describe, expect, test } from 'bun:test';
import { sceneAnalysisExample } from './scene-analysis.example';
import { sceneAnalysisSchema } from './scene-analysis.schema';
import { VELRO_UNIVERSAL_SYSTEM_PROMPT } from './prompts';

describe('Scene Analysis Schema Validation', () => {
  test('example data conforms to schema', () => {
    const result = sceneAnalysisSchema.safeParse(sceneAnalysisExample);

    if (!result.success) {
      console.error(
        'Validation errors:',
        JSON.stringify(result.error.format(), null, 2)
      );
    }

    expect(result.success).toBe(true);
  });

  test('example has correct structure', () => {
    expect(sceneAnalysisExample.status).toBe('success');
    expect(sceneAnalysisExample.scenes).toHaveLength(1);
    expect(sceneAnalysisExample.characterBible).toHaveLength(1);
    expect(sceneAnalysisExample.projectMetadata).toBeDefined();
  });

  test('scenes have required fields', () => {
    for (const scene of sceneAnalysisExample.scenes) {
      expect(scene.sceneId).toBeDefined();
      expect(scene.sceneNumber).toBeGreaterThan(0);
      expect(scene.originalScript).toBeDefined();
      expect(scene.metadata).toBeDefined();
      expect(scene.selectedVariant).toBeDefined();
      expect(scene.prompts).toBeDefined();
      expect(scene.prompts?.visual).toBeDefined();
      expect(scene.prompts?.motion).toBeDefined();
    }
  });

  test('visual prompts have all required components', () => {
    for (const scene of sceneAnalysisExample.scenes) {
      if (!scene.prompts?.visual) continue;
      const { components } = scene.prompts.visual;
      expect(components?.sceneDescription).toBeDefined();
      expect(components?.subject).toBeDefined();
      expect(components?.environment).toBeDefined();
      expect(components?.lighting).toBeDefined();
      expect(components?.camera).toBeDefined();
      expect(components?.composition).toBeDefined();
      expect(components?.style).toBeDefined();
      expect(components?.technical).toBeDefined();
      expect(components?.atmosphere).toBeDefined();
    }
  });

  test('motion prompts have all required components', () => {
    for (const scene of sceneAnalysisExample.scenes) {
      if (!scene.prompts?.motion) continue;
      const { components } = scene.prompts.motion;
      expect(components?.cameraMovement).toBeDefined();
      expect(components?.startPosition).toBeDefined();
      expect(components?.endPosition).toBeDefined();
      expect(components?.durationSeconds).toBeGreaterThan(0);
      expect(components?.speed).toBeDefined();
      expect(components?.smoothness).toBeDefined();
      expect(components?.subjectTracking).toBeDefined();
      expect(components?.equipment).toBeDefined();
    }
  });

  test('variants have exactly 3 options each when present', () => {
    const scene1 = sceneAnalysisExample.scenes[0];
    if (scene1.variants) {
      expect(scene1.variants.cameraAngles).toHaveLength(3);
      expect(scene1.variants.movementStyles).toHaveLength(3);
      expect(scene1.variants.moodTreatments).toHaveLength(3);
    }
  });

  test('selected variants reference valid variant IDs', () => {
    const scene1 = sceneAnalysisExample.scenes[0];
    if (!scene1.selectedVariant) return;
    expect(['A1', 'A2', 'A3']).toContain(scene1.selectedVariant.cameraAngle);
    if (scene1.selectedVariant.movementStyle) {
      expect(['B1', 'B2', 'B3']).toContain(
        scene1.selectedVariant.movementStyle
      );
    }
    expect(['C1', 'C2', 'C3']).toContain(scene1.selectedVariant.moodTreatment);
  });

  test('character bible entries have required fields', () => {
    for (const character of sceneAnalysisExample.characterBible || []) {
      expect(character.characterId).toBeDefined();
      expect(character.name).toBeDefined();
      expect(character.firstMention).toBeDefined();
      expect(character.physicalDescription).toBeDefined();
      expect(character.standardClothing).toBeDefined();
      expect(character.consistencyTag).toBeDefined();
    }
  });
});

describe('VELRO_UNIVERSAL_SYSTEM_PROMPT Integration', () => {
  test('includes the stringified sceneAnalysisExample', () => {
    // The prompt should contain the actual JSON, not the template literal
    expect(VELRO_UNIVERSAL_SYSTEM_PROMPT).toContain('"status": "success"');
    expect(VELRO_UNIVERSAL_SYSTEM_PROMPT).toContain('"characterBible"');
    expect(VELRO_UNIVERSAL_SYSTEM_PROMPT).toContain('"scenes"');

    // Should not contain the template literal syntax
    expect(VELRO_UNIVERSAL_SYSTEM_PROMPT).not.toContain('${JSON.stringify');
  });

  test('includes example structure with proper formatting', () => {
    // Check that key parts of the example are present
    const expectedJson = JSON.stringify(sceneAnalysisExample, null, 2);
    expect(VELRO_UNIVERSAL_SYSTEM_PROMPT).toContain(expectedJson);
  });

  test('includes critical JSON rules after example', () => {
    expect(VELRO_UNIVERSAL_SYSTEM_PROMPT).toContain('CRITICAL JSON RULES');
    expect(VELRO_UNIVERSAL_SYSTEM_PROMPT).toContain(
      'CRITICAL SCRIPT EXTRACTION RULES'
    );
  });

  test('prompt contains json_output_format section', () => {
    expect(VELRO_UNIVERSAL_SYSTEM_PROMPT).toContain('<json_output_format>');
    expect(VELRO_UNIVERSAL_SYSTEM_PROMPT).toContain('</json_output_format>');
  });
});
