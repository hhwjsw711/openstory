/**
 * MCP Server Route Handler
 * Uses mcp-handler for Streamable HTTP transport (protocol 2025-06-18)
 */

import { createFileRoute } from '@tanstack/react-router';
import { isLocalDevelopment } from '@/lib/utils/environment';
import { createMcpHandler } from 'mcp-handler';

/**
 * Fetch a URL and return base64-encoded data with mime type
 */
async function fetchAsBase64(
  url: string
): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return { data: base64, mimeType: contentType };
}
// Import tool implementations
import {
  analyzeScriptInputSchema,
  analyzeScriptTool,
} from '@/lib/mcp/tools/analyze-script';

import {
  generateImageInputSchema,
  generateImageTool,
} from '@/lib/mcp/tools/generate-image';
import { generateMotionTool } from '@/lib/mcp/tools/generate-motion';
// Import granular phase tools
import {
  designAudioInputSchema,
  designAudioTool,
} from '@/lib/mcp/tools/design-audio';
import {
  extractCharactersInputSchema,
  extractCharactersTool,
} from '@/lib/mcp/tools/extract-characters';
import {
  generateMotionPromptsInputSchema,
  generateMotionPromptsTool,
} from '@/lib/mcp/tools/generate-motion-prompts';
import {
  generateVisualPromptsInputSchema,
  generateVisualPromptsTool,
} from '@/lib/mcp/tools/generate-visual-prompts';
import {
  splitScenesInputSchema,
  splitScenesTool,
} from '@/lib/mcp/tools/split-scenes';

// Import resources
import { formatStylesAsText } from '@/lib/mcp/resources/styles';
import {
  type GenerateMotionOptions,
  generationMotionOptionsSchema,
} from '@/lib/motion/motion-generation';

// Lazy initialization to avoid Cloudflare Workers global scope restrictions
let _handler: ReturnType<typeof createMcpHandler> | null = null;

function getMcpHandler() {
  if (!_handler) {
    _handler = createMcpHandler(
      async (server) => {
        // Register tools
        server.registerTool(
          'generate_image',
          {
            title: 'Generate Image',
            description:
              'Generate a single cinematic image with a director style applied. Returns the image as base64.',
            inputSchema: generateImageInputSchema, // ZodRawShape - Zod v4 types are incompatible but runtime works correctly
          },
          async (args) => {
            console.log(`[MCP] Tool called: generate_image`);
            const result = await generateImageTool(args);

            // Fetch images and convert to base64
            const imageContents = await Promise.all(
              result.imageUrls.map(async (url) => {
                const { data, mimeType } = await fetchAsBase64(url);
                return {
                  type: 'image' as const,
                  data,
                  mimeType,
                };
              })
            );

            return {
              content: [
                // Include metadata as text (with URLs for programmatic access)
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      imageUrls: result.imageUrls,
                      generatedAt: result.generatedAt,
                      processingTimeMs: result.processingTimeMs,
                      provider: result.provider,
                      model: result.metadata.model,
                      dimensions: result.metadata.dimensions,
                    },
                    null,
                    2
                  ),
                },
                // Include base64 images
                ...imageContents,
              ],
            };
          }
        );

        server.registerTool(
          'analyze_script',
          {
            description:
              'Analyze a script and break it down into scenes with visual and motion prompts',
            inputSchema: analyzeScriptInputSchema, // ZodRawShape - Zod v4 types are incompatible but runtime works correctly
          },
          async (args) => {
            console.log(`[MCP] Tool called: analyze_script`);
            const result = await analyzeScriptTool(args);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }
        );

        server.registerTool(
          'generate_motion',
          {
            description:
              'Convert image to video with camera movement. Returns the video as base64.',
            inputSchema: generationMotionOptionsSchema, // ZodRawShape - Zod v4 types are incompatible but runtime works correctly
          },
          async (args: GenerateMotionOptions) => {
            console.log(`[MCP] Tool called: generate_motion`);
            const result = await generateMotionTool({
              imageUrl: args.imageUrl,
              prompt: args.prompt,
              model: args.model,
            });

            // If generation failed, return error as text
            if (!result.success || !result.videoUrl) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(
                      { success: false, error: result.error },
                      null,
                      2
                    ),
                  },
                ],
              };
            }

            // Fetch video and convert to base64
            const { data, mimeType } = await fetchAsBase64(result.videoUrl);

            return {
              content: [
                // Include metadata as text (with URL for programmatic access)
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    { success: true, videoUrl: result.videoUrl },
                    null,
                    2
                  ),
                },
                // Include base64 video
                {
                  type: 'image' as const, // MCP uses 'image' type for binary data
                  data,
                  mimeType, // will be video/mp4 or similar
                },
              ],
            };
          }
        );

        // Register granular phase tools
        server.registerTool(
          'split_scenes',
          {
            description:
              'Phase 1: Split a script into logical scenes with metadata (use this for step-by-step workflow)',
            inputSchema: splitScenesInputSchema,
          },
          async (args) => {
            console.log(`[MCP] Tool called: split_scenes`);
            const result = await splitScenesTool(args);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }
        );

        server.registerTool(
          'extract_characters',
          {
            description:
              'Phase 2: Extract character bible from scenes (use this for step-by-step workflow)',
            inputSchema: extractCharactersInputSchema,
          },
          async (args) => {
            console.log(`[MCP] Tool called: extract_characters`);
            const result = await extractCharactersTool({
              ...args,
              scenes: args.scenes,
            });
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }
        );

        server.registerTool(
          'generate_visual_prompts',
          {
            description:
              'Phase 3: Generate visual prompts for scenes (use this for step-by-step workflow)',
            inputSchema: generateVisualPromptsInputSchema,
          },
          async (args) => {
            console.log(`[MCP] Tool called: generate_visual_prompts`);
            const result = await generateVisualPromptsTool({
              ...args,
              scenes: args.scenes,
              characterBible: args.characterBible,
            });
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }
        );

        server.registerTool(
          'generate_motion_prompts',
          {
            description:
              'Phase 4: Generate motion prompts for scenes (use this for step-by-step workflow)',
            inputSchema: generateMotionPromptsInputSchema,
          },
          async (args) => {
            console.log(`[MCP] Tool called: generate_motion_prompts`);
            const result = await generateMotionPromptsTool({
              ...args,
              scenes: args.scenes,
            });
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }
        );

        server.registerTool(
          'design_audio',
          {
            description:
              'Phase 5: Generate audio design for scenes (use this for step-by-step workflow)',
            inputSchema: designAudioInputSchema,
          },
          async (args) => {
            console.log(`[MCP] Tool called: design_audio`);
            const result = await designAudioTool({
              ...args,
              scenes: args.scenes,
            });
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }
        );

        // Register resources
        server.resource('styles', 'velro://styles', async () => ({
          contents: [
            {
              uri: 'velro://styles',
              mimeType: 'text/plain',
              text: formatStylesAsText(),
            },
          ],
        }));
      },
      {
        serverInfo: {
          name: 'velro-mcp',
          version: '1.0.0',
        },
      },
      {
        streamableHttpEndpoint: '/api/mcp', // Explicitly set the endpoint
        maxDuration: 300, // 5 minutes for long-running generations
        verboseLogs: isLocalDevelopment(),
      }
    );
  }
  return _handler;
}

async function optionsHandler() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function handleGet({ request }: { request: Request }) {
  console.log('[MCP Route] GET request:', request.url);
  try {
    const response = await getMcpHandler()(request);
    console.log(
      '[MCP Route] GET response:',
      response.status,
      response.statusText
    );
    // Add CORS headers to response
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('[MCP Route] GET error:', error);
    throw error;
  }
}

async function handlePost({ request }: { request: Request }) {
  console.log('[MCP Route] POST request:', request.url);
  try {
    const response = await getMcpHandler()(request);
    console.log(
      '[MCP Route] POST response:',
      response.status,
      response.statusText
    );
    // Add CORS headers to response
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('[MCP Route] POST error:', error);
    throw error;
  }
}

async function handleDelete({ request }: { request: Request }) {
  console.log('[MCP Route] DELETE request:', request.url);
  try {
    const response = await getMcpHandler()(request);
    console.log(
      '[MCP Route] DELETE response:',
      response.status,
      response.statusText
    );
    // Add CORS headers to response
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('[MCP Route] DELETE error:', error);
    throw error;
  }
}

export const Route = createFileRoute('/api/mcp')({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: handleGet,
      POST: handlePost,
      DELETE: handleDelete,
    },
  },
});
