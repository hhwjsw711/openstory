/**
 * Tests for access code validation
 */

import { describe, expect, it } from 'bun:test';
import { isValidAccessCode, VALID_ACCESS_CODES } from './access-codes';

describe('Access Code Validation', () => {
  describe('isValidAccessCode', () => {
    it('should validate correct access codes', () => {
      // Test each valid code
      for (const code of VALID_ACCESS_CODES) {
        expect(isValidAccessCode(code)).toBe(true);
      }
    });

    it('should be case-insensitive', () => {
      const code = VALID_ACCESS_CODES[0];
      expect(isValidAccessCode(code.toLowerCase())).toBe(true);
      expect(isValidAccessCode(code.toUpperCase())).toBe(true);
      expect(isValidAccessCode('CoSmIc-FaLcOn-2847')).toBe(true);
    });

    it('should trim whitespace', () => {
      const code = VALID_ACCESS_CODES[0];
      expect(isValidAccessCode(`  ${code}  `)).toBe(true);
      expect(isValidAccessCode(`\n${code}\n`)).toBe(true);
      expect(isValidAccessCode(`\t${code}\t`)).toBe(true);
    });

    it('should reject invalid codes', () => {
      expect(isValidAccessCode('INVALID-CODE-1234')).toBe(false);
      expect(isValidAccessCode('FAKE-ACCESS-9999')).toBe(false);
      expect(isValidAccessCode('NOT-A-CODE-0000')).toBe(false);
    });

    it('should reject empty or null values', () => {
      expect(isValidAccessCode('')).toBe(false);
      expect(isValidAccessCode('   ')).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(isValidAccessCode(null)).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(isValidAccessCode(undefined)).toBe(false);
    });

    it('should reject non-string values', () => {
      // @ts-expect-error - Testing invalid input
      expect(isValidAccessCode(123)).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(isValidAccessCode({})).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(isValidAccessCode([])).toBe(false);
    });

    it('should handle partial matches correctly', () => {
      // Partial codes should not be valid
      expect(isValidAccessCode('COSMIC-FALCON')).toBe(false);
      expect(isValidAccessCode('COSMIC')).toBe(false);
      expect(isValidAccessCode('2847')).toBe(false);
    });

    it('should handle codes with extra characters', () => {
      // Codes with extra characters should not be valid
      const code = VALID_ACCESS_CODES[0];
      expect(isValidAccessCode(`${code}X`)).toBe(false);
      expect(isValidAccessCode(`X${code}`)).toBe(false);
      expect(isValidAccessCode(`${code}-EXTRA`)).toBe(false);
    });
  });

  describe('VALID_ACCESS_CODES', () => {
    it('should have at least one code', () => {
      expect(VALID_ACCESS_CODES.length).toBeGreaterThan(0);
    });

    it('should have all codes in uppercase', () => {
      for (const code of VALID_ACCESS_CODES) {
        const codeString = code as string;
        expect(codeString).toBe(codeString.toUpperCase());
      }
    });

    it('should have no duplicate codes', () => {
      const unique = new Set(VALID_ACCESS_CODES);
      expect(unique.size).toBe(VALID_ACCESS_CODES.length);
    });

    it('should follow expected format (WORD-WORD-DIGITS)', () => {
      for (const code of VALID_ACCESS_CODES) {
        // Basic format check - should have two dashes
        const codeString = code as string;
        expect(codeString.split('-').length).toBe(3);

        // Should end with digits
        const parts = codeString.split('-');
        const lastPart = parts[parts.length - 1];
        expect(/^\d+$/.test(lastPart)).toBe(true);
      }
    });
  });
});
