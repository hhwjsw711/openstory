import { describe, expect, test } from 'bun:test';
import { sanitizeFailResponse } from './sanitize-fail-response';

describe('sanitizeFailResponse', () => {
  test('passes through a normal error string unchanged', () => {
    expect(sanitizeFailResponse('Something went wrong')).toBe(
      'Something went wrong'
    );
  });

  test('extracts inner message from QStash wrapper pattern', () => {
    const wrapped =
      "Couldn't parse 'failResponse' in 'failureFunction', received: 'error code: 1102'";
    expect(sanitizeFailResponse(wrapped)).toBe(
      'Worker exceeded memory limit (error code: 1102)'
    );
  });

  test('maps known CF error code 1102 to friendly message', () => {
    expect(sanitizeFailResponse('error code: 1102')).toBe(
      'Worker exceeded memory limit (error code: 1102)'
    );
  });

  test('extracts inner text for unknown error codes', () => {
    const wrapped =
      "Couldn't parse 'failResponse' in 'failureFunction', received: 'some unexpected error'";
    expect(sanitizeFailResponse(wrapped)).toBe('some unexpected error');
  });

  test('truncates excessively long messages', () => {
    const long = 'x'.repeat(600);
    const result = sanitizeFailResponse(long);
    expect(result.length).toBeLessThanOrEqual(501); // 500 + ellipsis char
    expect(result.endsWith('…')).toBe(true);
  });

  test('handles empty string', () => {
    expect(sanitizeFailResponse('')).toBe('Unknown error');
  });

  test('handles null/undefined', () => {
    expect(sanitizeFailResponse(null)).toBe('Unknown error');
    expect(sanitizeFailResponse(undefined)).toBe('Unknown error');
  });

  test('handles non-string values', () => {
    expect(sanitizeFailResponse(42)).toBe('42');
    expect(sanitizeFailResponse({ error: 'bad' })).toBe('{"error":"bad"}');
  });
});
