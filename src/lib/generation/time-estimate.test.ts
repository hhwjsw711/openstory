import { describe, expect, test } from 'bun:test';
import {
  estimateRemainingSeconds,
  estimateTotalSeconds,
  formatTimeRemaining,
} from './time-estimate';

describe('estimateTotalSeconds', () => {
  test('returns reasonable values for different scene counts', () => {
    const one = estimateTotalSeconds(1);
    const six = estimateTotalSeconds(6);
    const twelve = estimateTotalSeconds(12);

    expect(one).toBeGreaterThan(60);
    expect(six).toBeGreaterThan(one);
    expect(twelve).toBeGreaterThan(six);
  });

  test('uses default scene count for 0', () => {
    expect(estimateTotalSeconds(0)).toBe(estimateTotalSeconds(6));
  });
});

describe('estimateRemainingSeconds', () => {
  test('decreases as phases complete', () => {
    const full = estimateRemainingSeconds({
      sceneCount: 6,
      completedPhases: [],
      elapsedSeconds: 0,
    });

    const partial = estimateRemainingSeconds({
      sceneCount: 6,
      completedPhases: [1, 2, 3],
      elapsedSeconds: 30,
    });

    expect(partial).toBeLessThan(full);
  });

  test('never returns negative', () => {
    const result = estimateRemainingSeconds({
      sceneCount: 6,
      completedPhases: [1, 2, 3, 4, 5, 6, 7],
      elapsedSeconds: 9999,
    });

    expect(result).toBe(0);
  });

  test('returns 0 when all phases completed', () => {
    const result = estimateRemainingSeconds({
      sceneCount: 1,
      completedPhases: [1, 2, 3, 4, 5, 6, 7],
      elapsedSeconds: 0,
    });

    expect(result).toBe(0);
  });
});

describe('formatTimeRemaining', () => {
  test('shows "Finishing up…" at 0', () => {
    expect(formatTimeRemaining(0)).toBe('Finishing up\u2026');
  });

  test('shows seconds for < 60', () => {
    expect(formatTimeRemaining(30)).toBe('~30s remaining');
  });

  test('shows minutes:seconds for 60', () => {
    expect(formatTimeRemaining(60)).toBe('~1:00 remaining');
  });

  test('shows minutes:seconds for 150', () => {
    expect(formatTimeRemaining(150)).toBe('~2:30 remaining');
  });
});
