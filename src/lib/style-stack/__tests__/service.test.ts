// Set required environment variables BEFORE any imports
process.env.POSTGRES_URL = 'postgresql://test:test@localhost:5432/test';
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-testing-purposes-only';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';

import { schema } from '@/lib/db/schema';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { drizzle } from 'drizzle-orm/node-postgres';

// Mock BetterAuth config BEFORE any imports that use it
mock.module('@/lib/auth/config', () => ({
  auth: {
    api: {
      getSession: mock(() => Promise.resolve({ user: null })),
      signInAnonymous: mock(() =>
        Promise.resolve({ user: null, token: 'mock-token' })
      ),
      signOut: mock(() => Promise.resolve({ success: true })),
    },
  },
}));

// Mock user actions that import auth config
mock.module('#actions/user', () => ({
  getCurrentUser: mock(() => Promise.resolve({ user: null })),
}));

import type { StyleStackConfig } from '../../schemas/style-stack';

// Create mock database using drizzle.mock()
const mockDb = drizzle.mock({ schema: schema });

void mock.module('@/lib/db/client', () => ({
  db: mockDb,
}));

// Test data
const mockStyleConfig: StyleStackConfig = {
  version: '1.0',
  name: 'Test Style',
  base: {
    mood: 'dark, mysterious',
    lighting: 'high contrast shadows',
    color_palette: 'monochrome with red accents',
    camera: 'low angles, dutch tilts',
  },
  models: {
    'flux-pro': {
      additional_prompt: 'film noir style',
      negative_prompt: 'colorful, bright',
      guidance_scale: 8.0,
      steps: 25,
    },
  },
};

const mockUser = {
  id: '1359a1a3-e189-448d-8451-734b4be680ec',
  email: 'test@example.com',
};

const mockTeamId = '17b89066-9c5b-4132-9067-fa5ea7af2e9c';

const mockStyle = {
  id: '6de92947-647b-4c33-a6b8-1f8fed2787d1',
  teamId: mockTeamId,
  name: 'Test Style',
  description: 'A test style',
  config: mockStyleConfig,
  category: 'cinematic',
  tags: ['test', 'noir'],
  isPublic: false,
  isTemplate: false,
  version: 1,
  parentId: null,
  previewUrl: null,
  usageCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: mockUser.id,
};

describe('StyleStackService', () => {
  let styleService: any;

  beforeEach(async () => {
    mock.restore();

    const { StyleStackService } = await import('../service');
    styleService = new StyleStackService();
  });

  describe('createStyle', () => {
    it('should validate input schema', () => {
      const invalidInput = {
        name: '', // Invalid: empty name
        config: {}, // Invalid: missing required fields
      };

      expect(
        styleService.createStyle(invalidInput as any, mockUser.id)
      ).rejects.toThrow();
    });
  });

  describe('getDefaultTemplates', () => {
    it('should be defined', () => {
      expect(styleService.getDefaultTemplates).toBeDefined();
    });
  });
});
