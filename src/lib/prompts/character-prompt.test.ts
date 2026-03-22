import { describe, expect, test } from 'bun:test';
import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import {
  buildCastingAttributes,
  buildCharacterSheetPrompt,
} from './character-prompt';

const scriptEntry: CharacterBibleEntry = {
  characterId: 'char_001',
  name: 'Detective Sarah',
  age: '30s',
  gender: 'Female',
  ethnicity: 'Caucasian',
  physicalDescription: 'Tall, blonde hair, blue eyes',
  standardClothing: 'Dark trench coat, badge on belt',
  distinguishingFeatures: 'Small scar on left cheek',
  consistencyTag: 'detective_sarah_blonde_30s',
};

const talentMetadata: CharacterBibleEntry = {
  characterId: 'talent_sheet_1',
  name: 'Elvis Presley',
  age: '25',
  gender: 'Male',
  ethnicity: 'White',
  physicalDescription: 'Dark hair, sideburns, athletic build',
  standardClothing: 'White jumpsuit',
  distinguishingFeatures: 'Signature sideburns',
  consistencyTag: 'elvis_presley',
};

describe('buildCastingAttributes', () => {
  test('uses talent physical attributes over script', () => {
    const result = buildCastingAttributes(scriptEntry, {
      sheetMetadata: talentMetadata,
      talentName: 'Elvis Presley',
    });

    expect(result.age).toBe('25');
    expect(result.gender).toBe('Male');
    expect(result.ethnicity).toBe('White');
    expect(result.physicalDescription).toBe(
      'Dark hair, sideburns, athletic build'
    );
  });

  test('keeps costume and distinguishing features from script', () => {
    const result = buildCastingAttributes(scriptEntry, {
      sheetMetadata: talentMetadata,
      talentName: 'Elvis Presley',
    });

    expect(result.standardClothing).toBe('Dark trench coat, badge on belt');
    expect(result.distinguishingFeatures).toBe('Small scar on left cheek');
  });

  test('generates consistencyTag from characterId + talent name', () => {
    const result = buildCastingAttributes(scriptEntry, {
      sheetMetadata: talentMetadata,
      talentName: 'Elvis Presley',
    });

    expect(result.consistencyTag).toBe('char_001_elvis_presley');
  });

  test('falls back to script attributes when talent metadata is missing', () => {
    const result = buildCastingAttributes(scriptEntry, {
      talentName: 'Elvis Presley',
    });

    expect(result.age).toBe('30s');
    expect(result.gender).toBe('Female');
    expect(result.ethnicity).toBe('Caucasian');
  });

  test('uses talent name in physicalDescription when talent metadata has no physicalDescription', () => {
    const sparseMetadata: CharacterBibleEntry = {
      ...talentMetadata,
      physicalDescription: '',
    };

    const result = buildCastingAttributes(scriptEntry, {
      sheetMetadata: sparseMetadata,
      talentName: 'Elvis Presley',
    });

    expect(result.physicalDescription).toContain('Elvis Presley');
    expect(result.physicalDescription).toContain('real-world appearance');
  });

  test('consistencyTag is deterministic', () => {
    const result1 = buildCastingAttributes(scriptEntry, {
      sheetMetadata: talentMetadata,
      talentName: 'Elvis Presley',
    });
    const result2 = buildCastingAttributes(scriptEntry, {
      sheetMetadata: talentMetadata,
      talentName: 'Elvis Presley',
    });

    expect(result1.consistencyTag).toBe(result2.consistencyTag);
  });

  test('uses sparse talent fields over script when available', () => {
    const partialMeta: CharacterBibleEntry = {
      ...talentMetadata,
      age: '40',
      gender: '',
      ethnicity: '',
      physicalDescription: 'Muscular build',
    };

    const result = buildCastingAttributes(scriptEntry, {
      sheetMetadata: partialMeta,
      talentName: 'Test Actor',
    });

    expect(result.age).toBe('40');
    expect(result.gender).toBe('Female'); // falls back to script
    expect(result.ethnicity).toBe('Caucasian'); // falls back to script
    expect(result.physicalDescription).toBe('Muscular build');
  });
});

describe('buildCharacterSheetPrompt with talent', () => {
  test('uses talent description as fallback when physicalDescription is empty', () => {
    const { prompt } = buildCharacterSheetPrompt(scriptEntry, {
      description: 'This character should look like Elvis Presley',
    });

    expect(prompt).toContain('Elvis Presley');
    expect(prompt).toContain('real-world appearance');
  });

  test('strengthened reference instruction mentions image priority', () => {
    const { prompt } = buildCharacterSheetPrompt(scriptEntry, {
      sheetMetadata: talentMetadata,
      sheetImageUrl: 'https://example.com/sheet.png',
    });

    expect(prompt).toContain('IMAGE takes priority');
    expect(prompt).toContain('DO NOT alter their fundamental physical');
  });
});
