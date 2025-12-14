import { MOCK_SYSTEM_STYLES } from '@/lib/style/style-templates';
import type { Style } from '@/types/database';
import { http, HttpResponse } from 'msw';
import { generateMockFrames } from './data-generators';
import { generateChaptersVTT } from '@/lib/vtt/generate-chapters';

const stylePresets: Style[] = MOCK_SYSTEM_STYLES;

/**
 * Creates a mock SSE stream for the realtime endpoint.
 * Returns a connected message then keeps connection minimal.
 */
function createMockSSEStream() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected message
      controller.enqueue(
        encoder.encode('data: {"type":"connected","channel":"default"}\n\n')
      );
    },
  });
  return stream;
}

/**
 * MSW handlers for mocking API requests in Storybook and tests
 * These handlers intercept fetch requests and return mock data
 */
export const handlers = [
  // GET /api/realtime - Mock SSE endpoint for Upstash Realtime
  http.get('/api/realtime', () => {
    return new HttpResponse(createMockSSEStream(), {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }),

  // GET /api/user/me - Get current user
  http.get('/api/user/me', () => {
    return HttpResponse.json({
      success: true,
      data: {
        user: {
          id: 'mock-user-id',
          email: 'demo@example.com',
          name: 'Demo User',
          emailVerified: false,
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        isAuthenticated: true,
        isAnonymous: false,
        teamId: 'demo-team',
        teamRole: 'owner',
        teamName: 'Demo Team',
      },
    });
  }),

  // POST /api/auth/sign-in/anonymous - Create anonymous session
  http.post('/api/auth/sign-in/anonymous', () => {
    return HttpResponse.json({
      user: {
        id: 'mock-anonymous-user',
        email: null,
        name: 'Anonymous User',
        emailVerified: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: 'mock-session-id',
        userId: 'mock-anonymous-user',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
        token: 'mock-token',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }),

  // GET /api/auth/get-session - Get current session
  http.get('/api/auth/get-session', () => {
    return HttpResponse.json({
      user: {
        id: 'mock-user-id',
        email: 'demo@example.com',
        name: 'Demo User',
        emailVerified: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: 'mock-session-id',
        userId: 'mock-user-id',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        token: 'mock-token',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }),

  // GET /api/styles - List all styles
  http.get('/api/styles', () => {
    return HttpResponse.json({
      success: true,
      data: stylePresets,
    });
  }),

  // GET /api/styles/:id - Get single style
  http.get('/api/styles/:id', ({ params }) => {
    const { id } = params;
    const style = stylePresets.find((s) => s.id === id);

    if (!style) {
      return HttpResponse.json(
        {
          success: false,
          message: 'Style not found',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: style,
    });
  }),

  // POST /api/styles - Create new style
  http.post('/api/styles', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    const newStyle = {
      id: `style-${Date.now()}`,
      name: body.name as string,
      description: body.description as string | null,
      config: body.config,
      category: (body.category as string) || null,
      tags: (body.tags as string[]) || null,
      isPublic: (body.is_public as boolean) || false,
      isTemplate: false,
      previewUrl: (body.preview_url as string) || null,
      teamId: 'team-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'mock-user',
      usageCount: 0,
      version: null,
    };

    return HttpResponse.json({
      success: true,
      data: newStyle,
    });
  }),

  // PATCH /api/styles/:id - Update style
  http.patch('/api/styles/:id', async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const style = stylePresets.find((s) => s.id === id);

    if (!style) {
      return HttpResponse.json(
        {
          success: false,
          message: 'Style not found',
        },
        { status: 404 }
      );
    }

    const updatedStyle = {
      ...style,
      ...body,
      updatedAt: new Date(),
    };

    return HttpResponse.json({
      success: true,
      data: updatedStyle,
    });
  }),

  // DELETE /api/styles/:id - Delete style
  http.delete('/api/styles/:id', ({ params }) => {
    const { id } = params;
    const style = stylePresets.find((s) => s.id === id);

    if (!style) {
      return HttpResponse.json(
        {
          success: false,
          message: 'Style not found',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
    });
  }),

  // GET /api/sequences/:sequenceId/chapters.vtt - Chapter markers
  http.get('/api/sequences/:sequenceId/chapters.vtt', ({ params }) => {
    const { sequenceId } = params;

    // Generate mock frames with scene metadata
    const mockFrames = generateMockFrames(5, sequenceId as string).map(
      (frame, index) => {
        if (!frame.metadata) {
          return frame;
        }

        return {
          ...frame,
          orderIndex: index,
          durationMs: 5000, // 5 seconds per frame
          metadata: {
            ...frame.metadata,
            sceneNumber: index + 1,
            metadata: {
              ...frame.metadata.metadata,
              title: [
                'Opening Scene',
                'The Journey Begins',
                'Rising Action',
                'Climax',
                'Resolution',
              ][index],
            },
          },
        };
      }
    );

    // Generate chapters VTT
    const vtt = generateChaptersVTT(mockFrames);

    return new HttpResponse(vtt, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }),
];
