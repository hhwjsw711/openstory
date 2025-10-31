import { MOCK_SYSTEM_STYLES } from '@/lib/style/style-templates';
import { Style } from '@/types/database';
import { http, HttpResponse } from 'msw';

const stylePresets: Style[] = MOCK_SYSTEM_STYLES;

/**
 * MSW handlers for mocking API requests in Storybook and tests
 * These handlers intercept fetch requests and return mock data
 */
export const handlers = [
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
      parentId: null,
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
];
