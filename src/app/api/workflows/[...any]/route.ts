/**
 * Image generation workflow
 * Generates images using AI models and optionally updates frame thumbnails
 */

import { generateImageWorkflow } from '@/app/api/workflows/[...any]/image-workflow';
import { generateMotionWorkflow } from '@/app/api/workflows/[...any]/motion-workflow';
import { generateStoryboardWorkflow } from '@/app/api/workflows/[...any]/storyboard-workflow';
import { getQStashWebhookUrl } from '@/lib/utils/get-base-url';
import { serveMany } from '@upstash/workflow/dist/nextjs';

export const { POST } = serveMany(
  {
    storyboard: generateStoryboardWorkflow,
    image: generateImageWorkflow,
    motion: generateMotionWorkflow,
  },
  {
    baseUrl: getQStashWebhookUrl(),
  }
);
