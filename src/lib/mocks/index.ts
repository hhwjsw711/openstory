/**
 * MSW Mocks - Barrel Export
 *
 * This file exports all mock-related utilities for easy importing.
 *
 * Usage:
 * - In Storybook: Automatically loaded via .storybook/preview.ts
 * - In Tests: Automatically loaded via src/test/setup.ts
 * - For custom overrides: import { server } from '@/lib/mocks'
 */

export { worker } from './browser';
export { handlers } from './handlers';
export { server } from './server';
