import { describe, it, expect } from 'bun:test';
import { db } from './client';

describe('Drizzle Database Client', () => {
  it('should export a database instance', () => {
    expect(db).toBeDefined();
    expect(typeof db).toBe('object');
  });

  it('should have query methods', () => {
    expect(typeof db.select).toBe('function');
    expect(typeof db.insert).toBe('function');
    expect(typeof db.update).toBe('function');
    expect(typeof db.delete).toBe('function');
  });
});
