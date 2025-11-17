import { describe, expect, test } from 'bun:test';
import type { Frame } from '@/types/database';
import type { Scene } from '@/lib/ai/scene-analysis.schema';
import { generateChaptersVTT } from './generate-chapters';

// Helper to create test frames with minimal required fields
const createTestFrame = (overrides: Partial<Frame>): Frame => ({
  id: '1',
  sequenceId: 'seq-1',
  orderIndex: 0,
  description: null,
  durationMs: 3000,
  videoUrl: null,
  videoPath: null,
  videoStatus: 'pending',
  thumbnailUrl: null,
  thumbnailPath: null,
  thumbnailStatus: 'pending',
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  thumbnailWorkflowRunId: null,
  thumbnailGeneratedAt: null,
  thumbnailError: null,
  imageModel: 'nano_banana',
  videoWorkflowRunId: null,
  videoGeneratedAt: null,
  videoError: null,
  ...overrides,
});

describe('generateChaptersVTT', () => {
  test('generates valid WebVTT chapters with metadata', () => {
    const frames: Frame[] = [
      createTestFrame({
        id: '1',
        durationMs: 5000,
        videoUrl: 'https://example.com/video1.mp4',
        videoStatus: 'completed',
        metadata: {
          sceneNumber: 1,
          metadata: {
            title: 'Opening Scene',
            durationSeconds: 5,
            location: 'Beach',
            timeOfDay: 'morning',
            storyBeat: 'Introduction',
          },
        } as Scene,
      }),
      createTestFrame({
        id: '2',
        orderIndex: 1,
        durationMs: 3000,
        videoUrl: 'https://example.com/video2.mp4',
        videoStatus: 'completed',
        metadata: {
          sceneNumber: 2,
          metadata: {
            title: 'Conflict Arises',
            durationSeconds: 3,
            location: 'Office',
            timeOfDay: 'afternoon',
            storyBeat: 'Rising action',
          },
        } as Scene,
      }),
    ];

    const vtt = generateChaptersVTT(frames);

    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('Scene 1: Opening Scene');
    expect(vtt).toContain('Scene 2: Conflict Arises');
    expect(vtt).toContain('00:00:00.000 --> 00:00:05.000');
    expect(vtt).toContain('00:00:05.000 --> 00:00:08.000');
  });

  test('handles frames without metadata', () => {
    const frames: Frame[] = [
      createTestFrame({
        id: '1',
        durationMs: 3000,
        videoUrl: 'https://example.com/video1.mp4',
        videoStatus: 'completed',
      }),
      createTestFrame({
        id: '2',
        orderIndex: 1,
        durationMs: 2000,
        videoUrl: 'https://example.com/video2.mp4',
        videoStatus: 'completed',
      }),
    ];

    const vtt = generateChaptersVTT(frames);

    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('Scene 1');
    expect(vtt).toContain('Scene 2');
  });

  test('defaults to 3 seconds when durationMs is null', () => {
    const frames: Frame[] = [
      createTestFrame({
        durationMs: null,
        videoUrl: 'https://example.com/video1.mp4',
        videoStatus: 'completed',
      }),
    ];

    const vtt = generateChaptersVTT(frames);

    expect(vtt).toContain('00:00:00.000 --> 00:00:03.000');
  });

  test('calculates cumulative time correctly', () => {
    const frames: Frame[] = [
      createTestFrame({
        id: '1',
        durationMs: 5000,
        videoUrl: 'https://example.com/video1.mp4',
        videoStatus: 'completed',
      }),
      createTestFrame({
        id: '2',
        orderIndex: 1,
        durationMs: 7000,
        videoUrl: 'https://example.com/video2.mp4',
        videoStatus: 'completed',
      }),
      createTestFrame({
        id: '3',
        orderIndex: 2,
        durationMs: 4000,
        videoUrl: 'https://example.com/video3.mp4',
        videoStatus: 'completed',
      }),
    ];

    const vtt = generateChaptersVTT(frames);

    // First chapter: 0-5 seconds
    expect(vtt).toContain('00:00:00.000 --> 00:00:05.000');
    // Second chapter: 5-12 seconds
    expect(vtt).toContain('00:00:05.000 --> 00:00:12.000');
    // Third chapter: 12-16 seconds
    expect(vtt).toContain('00:00:12.000 --> 00:00:16.000');
  });

  test('formats timestamps correctly for hours', () => {
    const frames: Frame[] = [
      createTestFrame({
        id: '1',
        durationMs: 3600000,
        videoUrl: 'https://example.com/video1.mp4',
        videoStatus: 'completed',
      }),
      createTestFrame({
        id: '2',
        orderIndex: 1,
        durationMs: 125000,
        videoUrl: 'https://example.com/video2.mp4',
        videoStatus: 'completed',
      }),
    ];

    const vtt = generateChaptersVTT(frames);

    expect(vtt).toContain('00:00:00.000 --> 01:00:00.000');
    expect(vtt).toContain('01:00:00.000 --> 01:02:05.000');
  });

  test('handles empty frames array', () => {
    const frames: Frame[] = [];

    const vtt = generateChaptersVTT(frames);

    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('NOTE Generated chapters from frames');
    // Should not contain any chapter markers
    const lines = vtt.split('\n').filter((line) => line.includes('-->'));
    expect(lines).toHaveLength(0);
  });

  test('uses scene metadata for chapter titles', () => {
    const frames: Frame[] = [
      createTestFrame({
        durationMs: 3000,
        videoUrl: 'https://example.com/video1.mp4',
        videoStatus: 'completed',
        metadata: {
          sceneNumber: 5,
          metadata: {
            title: 'The Great Revelation',
            durationSeconds: 3,
            location: 'Castle',
            timeOfDay: 'night',
            storyBeat: 'Climax',
          },
        } as Scene,
      }),
    ];

    const vtt = generateChaptersVTT(frames);

    expect(vtt).toContain('Scene 5: The Great Revelation');
  });

  test('handles fractional seconds in timestamps', () => {
    const frames: Frame[] = [
      createTestFrame({
        durationMs: 1234, // 1.234 seconds
        videoUrl: 'https://example.com/video1.mp4',
        videoStatus: 'completed',
      }),
    ];

    const vtt = generateChaptersVTT(frames);

    expect(vtt).toContain('00:00:00.000 --> 00:00:01.234');
  });
});
