/**
 * Tests for PATCH /api/sequences/[sequenceId]
 * Verifies that storyboard regeneration only triggers for relevant field changes
 */

import { PATCH } from '../route';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Test constants - using valid UUIDs
const TEST_SEQUENCE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_TEAM_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_STYLE_ID = '550e8400-e29b-41d4-a716-446655440003';
const TEST_NEW_STYLE_ID = '550e8400-e29b-41d4-a716-446655440004';

// Mock authentication
const mockRequireUser = mock(() =>
  Promise.resolve({ id: TEST_USER_ID, email: 'test@example.com' })
);
const mockRequireTeamMemberAccess = mock(() => Promise.resolve());

mock.module('@/lib/auth/action-utils', () => ({
  requireUser: mockRequireUser,
  requireTeamMemberAccess: mockRequireTeamMemberAccess,
}));

// Mock database helpers
const mockGetSequenceById = mock<
  () => Promise<{
    id: string;
    teamId: string;
    title: string;
    script: string;
    styleId: string;
    aspectRatio: string;
    analysisModel: string;
    status: string;
  } | null>
>(() =>
  Promise.resolve({
    id: TEST_SEQUENCE_ID,
    teamId: TEST_TEAM_ID,
    title: 'Test Sequence',
    script: 'Original script',
    styleId: TEST_STYLE_ID,
    aspectRatio: '16:9',
    analysisModel: 'anthropic/claude-haiku-4.5',
    status: 'draft',
  })
);

mock.module('@/lib/db/helpers/queries', () => ({
  getSequenceById: mockGetSequenceById,
}));

// Mock sequence service
const mockUpdateSequence = mock((params) =>
  Promise.resolve({
    id: params.id,
    ...params,
  })
);

mock.module('@/lib/services/sequence.service', () => ({
  sequenceService: {
    updateSequence: mockUpdateSequence,
  },
}));

// Mock workflow trigger
const mockTriggerWorkflow = mock(() => Promise.resolve());

mock.module('@/lib/workflow', () => ({
  triggerWorkflow: mockTriggerWorkflow,
}));

// Mock Next.js cache
mock.module('next/cache', () => ({
  revalidatePath: mock(() => {}),
}));

// Mock error handlers
mock.module('@/lib/errors', () => ({
  handleApiError: (error: Error) => ({
    statusCode: 500,
    toJSON: () => ({ message: error.message }),
  }),
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
}));

describe('PATCH /api/sequences/[sequenceId]', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    mockRequireUser.mockClear();
    mockRequireTeamMemberAccess.mockClear();
    mockGetSequenceById.mockClear();
    mockUpdateSequence.mockClear();
    mockTriggerWorkflow.mockClear();
  });

  describe('Storyboard Regeneration Logic', () => {
    it('should NOT trigger regeneration when only title is updated', async () => {
      const request = new Request(
        `http://localhost:3000/api/sequences/${TEST_SEQUENCE_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title: 'New Title' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const params = Promise.resolve({ sequenceId: TEST_SEQUENCE_ID });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(mockTriggerWorkflow).not.toHaveBeenCalled();

      // Verify status was not set to 'processing'
      expect(mockUpdateSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          id: TEST_SEQUENCE_ID,
          title: 'New Title',
          status: undefined, // Should be undefined when not regenerating
        })
      );
    });

    it('should NOT trigger regeneration when only metadata is updated', async () => {
      const request = new Request(
        `http://localhost:3000/api/sequences/${TEST_SEQUENCE_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            metadata: { frameGeneration: { completedFrameCount: 5 } },
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const params = Promise.resolve({ sequenceId: TEST_SEQUENCE_ID });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(mockTriggerWorkflow).not.toHaveBeenCalled();
      expect(mockUpdateSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          status: undefined,
        })
      );
    });

    it('should trigger regeneration when script is updated', async () => {
      const request = new Request(
        `http://localhost:3000/api/sequences/${TEST_SEQUENCE_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ script: 'New script content' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const params = Promise.resolve({ sequenceId: TEST_SEQUENCE_ID });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(mockTriggerWorkflow).toHaveBeenCalledTimes(1);
      expect(mockTriggerWorkflow).toHaveBeenCalledWith(
        '/storyboard',
        expect.objectContaining({
          userId: TEST_USER_ID,
          teamId: TEST_TEAM_ID,
          sequenceId: TEST_SEQUENCE_ID,
        })
      );

      // Verify status was set to 'processing'
      expect(mockUpdateSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processing',
        })
      );
    });

    it('should trigger regeneration when styleId is updated', async () => {
      const request = new Request(
        `http://localhost:3000/api/sequences/${TEST_SEQUENCE_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ styleId: TEST_NEW_STYLE_ID }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const params = Promise.resolve({ sequenceId: TEST_SEQUENCE_ID });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(mockTriggerWorkflow).toHaveBeenCalledTimes(1);
      expect(mockUpdateSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processing',
        })
      );
    });

    it('should trigger regeneration when aspectRatio is updated', async () => {
      const request = new Request(
        `http://localhost:3000/api/sequences/${TEST_SEQUENCE_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ aspectRatio: '9:16' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const params = Promise.resolve({ sequenceId: TEST_SEQUENCE_ID });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(mockTriggerWorkflow).toHaveBeenCalledTimes(1);
      expect(mockUpdateSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processing',
        })
      );
    });

    it('should trigger regeneration when analysisModel is updated', async () => {
      const request = new Request(
        `http://localhost:3000/api/sequences/${TEST_SEQUENCE_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            analysisModel: 'anthropic/claude-sonnet-4.5',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const params = Promise.resolve({ sequenceId: TEST_SEQUENCE_ID });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(mockTriggerWorkflow).toHaveBeenCalledTimes(1);
      expect(mockUpdateSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processing',
        })
      );
    });

    it('should trigger regeneration when title AND script are updated', async () => {
      const request = new Request(
        `http://localhost:3000/api/sequences/${TEST_SEQUENCE_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: 'New Title',
            script: 'New script content',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const params = Promise.resolve({ sequenceId: TEST_SEQUENCE_ID });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(mockTriggerWorkflow).toHaveBeenCalledTimes(1);
      expect(mockUpdateSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Title',
          script: 'New script content',
          status: 'processing',
        })
      );
    });

    it('should trigger regeneration when multiple storyboard-affecting fields are updated', async () => {
      const request = new Request(
        `http://localhost:3000/api/sequences/${TEST_SEQUENCE_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            script: 'New script',
            styleId: TEST_NEW_STYLE_ID,
            aspectRatio: '9:16',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const params = Promise.resolve({ sequenceId: TEST_SEQUENCE_ID });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(mockTriggerWorkflow).toHaveBeenCalledTimes(1);
      expect(mockUpdateSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processing',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when sequence not found', async () => {
      mockGetSequenceById.mockResolvedValueOnce(null);

      const request = new Request(
        `http://localhost:3000/api/sequences/${TEST_SEQUENCE_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title: 'New Title' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const params = Promise.resolve({ sequenceId: TEST_SEQUENCE_ID });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(404);
      expect(mockUpdateSequence).not.toHaveBeenCalled();
      expect(mockTriggerWorkflow).not.toHaveBeenCalled();
    });
  });
});
