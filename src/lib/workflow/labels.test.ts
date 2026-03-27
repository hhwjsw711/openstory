import { describe, expect, test } from 'bun:test';
import { buildWorkflowLabel } from './labels';

describe('buildWorkflowLabel', () => {
  test('returns title and short id when both provided', () => {
    expect(buildWorkflowLabel('My Sequence', '01ABCDEF12345678')).toBe(
      'My Sequence (01ABCDEF)'
    );
  });

  test('returns only short id when no title', () => {
    expect(buildWorkflowLabel(undefined, '01ABCDEF12345678')).toBe('01ABCDEF');
  });

  test('returns only title when no id', () => {
    expect(buildWorkflowLabel('My Sequence', undefined)).toBe('My Sequence');
  });

  test('returns undefined when neither provided', () => {
    expect(buildWorkflowLabel(undefined, undefined)).toBeUndefined();
  });

  test('truncates long titles to 50 chars', () => {
    const longTitle = 'A'.repeat(60);
    const result = buildWorkflowLabel(longTitle, '01ABCDEF12345678');
    expect(result).toBe(`${'A'.repeat(47)}... (01ABCDEF)`);
  });

  test('does not truncate titles at exactly 50 chars', () => {
    const title = 'A'.repeat(50);
    expect(buildWorkflowLabel(title, '01ABCDEF12345678')).toBe(
      `${title} (01ABCDEF)`
    );
  });

  test('handles short ids', () => {
    expect(buildWorkflowLabel('Test', 'abc')).toBe('Test (abc)');
  });

  test('handles empty string title', () => {
    expect(buildWorkflowLabel('', '01ABCDEF12345678')).toBe('01ABCDEF');
  });
});
