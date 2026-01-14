/**
 * Playwright Route Handlers for E2E Tests
 * Intercepts external API calls (fal.ai, QStash, R2) to return mock responses
 */

import type { Page, Route } from 'playwright/test';

/** Counter for generating unique mock file IDs */
let mockFileCounter = 0;

/**
 * Mock image generation response
 */
const mockImageResponse = {
  images: [
    {
      url: 'https://fal.media/files/mock/test-image.png',
      width: 1024,
      height: 1024,
      content_type: 'image/png',
    },
  ],
  timings: { inference: 2.5 },
  seed: 12345,
  has_nsfw_concepts: [false],
  prompt: 'Test prompt',
};

/**
 * Mock motion/video generation response
 */
const mockMotionResponse = {
  video: {
    url: 'https://fal.media/files/mock/test-video.mp4',
    content_type: 'video/mp4',
    file_name: 'output.mp4',
    file_size: 1024000,
  },
  seed: 12345,
};

/**
 * Mock QStash publish response
 */
const mockQStashResponse = {
  messageId: 'mock-message-id-12345',
};

/**
 * Set up route handlers on a page to mock external APIs
 */
export async function setupMockRoutes(page: Page): Promise<void> {
  // Mock fal.ai image generation
  await page.route('**/fal.run/**', async (route: Route) => {
    const url = route.request().url();

    if (url.includes('flux') || url.includes('stable-diffusion')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockImageResponse),
      });
    } else if (
      url.includes('kling') ||
      url.includes('wan') ||
      url.includes('video')
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMotionResponse),
      });
    } else {
      await route.continue();
    }
  });

  // Mock fal.ai queue endpoints
  await page.route('**/queue.fal.run/**', async (route: Route) => {
    const method = route.request().method();

    if (method === 'POST') {
      // Queue submission
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          request_id: 'mock-request-id-12345',
          status_url: 'https://queue.fal.run/mock/status',
          response_url: 'https://queue.fal.run/mock/response',
          cancel_url: 'https://queue.fal.run/mock/cancel',
        }),
      });
    } else if (method === 'GET') {
      // Status check or result fetch
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'COMPLETED',
          ...mockImageResponse,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock QStash publish
  await page.route('**/qstash.upstash.io/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockQStashResponse),
    });
  });

  // Mock R2 storage uploads (PutObject operations)
  await page.route('**/*.r2.cloudflarestorage.com/**', async (route: Route) => {
    const method = route.request().method();

    if (method === 'PUT') {
      // Successfully mock file upload
      await route.fulfill({
        status: 200,
        headers: {
          ETag: `"mock-etag-${++mockFileCounter}"`,
        },
      });
    } else if (method === 'GET' || method === 'HEAD') {
      // Mock file exists/download
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': '1024',
        },
        body: Buffer.from([]),
      });
    } else if (method === 'DELETE') {
      // Mock file deletion
      await route.fulfill({
        status: 204,
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Create a custom mock response handler
 */
export function createMockHandler(response: unknown) {
  return async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  };
}
