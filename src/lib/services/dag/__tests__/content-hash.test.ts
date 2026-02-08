import { describe, expect, it } from 'bun:test';
import { computeContentHash, computeInputHash } from '../content-hash';

describe('Content Hash', () => {
  describe('computeContentHash', () => {
    it('should produce deterministic hashes for identical data', async () => {
      const data = { name: 'test', value: 42 };
      const hash1 = await computeContentHash(data);
      const hash2 = await computeContentHash(data);
      expect(hash1).toBe(hash2);
    });

    it('should produce identical hashes regardless of property order', async () => {
      const data1 = { name: 'test', value: 42, active: true };
      const data2 = { active: true, value: 42, name: 'test' };
      const hash1 = await computeContentHash(data1);
      const hash2 = await computeContentHash(data2);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', async () => {
      const hash1 = await computeContentHash({ name: 'test' });
      const hash2 = await computeContentHash({ name: 'other' });
      expect(hash1).not.toBe(hash2);
    });

    it('should handle nested objects with sorted keys', async () => {
      const data1 = { outer: { b: 2, a: 1 } };
      const data2 = { outer: { a: 1, b: 2 } };
      const hash1 = await computeContentHash(data1);
      const hash2 = await computeContentHash(data2);
      expect(hash1).toBe(hash2);
    });

    it('should handle arrays (order matters)', async () => {
      const hash1 = await computeContentHash([1, 2, 3]);
      const hash2 = await computeContentHash([3, 2, 1]);
      expect(hash1).not.toBe(hash2);
    });

    it('should handle null and undefined values', async () => {
      const hash1 = await computeContentHash(null);
      const hash2 = await computeContentHash(null);
      expect(hash1).toBe(hash2);
    });

    it('should return a 64-character hex string (SHA-256)', async () => {
      const hash = await computeContentHash({ test: true });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('computeInputHash', () => {
    it('should produce deterministic hashes regardless of input order', async () => {
      const hashes = ['abc123', 'def456', 'ghi789'];
      const hash1 = await computeInputHash(hashes);
      const hash2 = await computeInputHash([...hashes].reverse());
      // computeInputHash sorts internally, so order shouldn't matter
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await computeInputHash(['abc123']);
      const hash2 = await computeInputHash(['def456']);
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty array', async () => {
      const hash = await computeInputHash([]);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
