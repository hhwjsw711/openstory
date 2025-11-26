/**
 * MCP Server Route Handler
 * Uses mcp-handler for Streamable HTTP transport (protocol 2025-06-18)
 */

import { isLocalDevelopment } from '@/lib/utils/environment';
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
// Import tool implementations
import { analyzeScriptTool } from '@/lib/mcp/tools/analyze-script';
import { generateFramesTool } from '@/lib/mcp/tools/generate-frames';
import { generateImageTool } from '@/lib/mcp/tools/generate-image';
import { generateMotionTool } from '@/lib/mcp/tools/generate-motion';
// Import granular phase tools
import { designAudioTool } from '@/lib/mcp/tools/design-audio';
import { extractCharactersTool } from '@/lib/mcp/tools/extract-characters';
import { generateMotionPromptsTool } from '@/lib/mcp/tools/generate-motion-prompts';
import { generateVisualPromptsTool } from '@/lib/mcp/tools/generate-visual-prompts';
import { splitScenesTool } from '@/lib/mcp/tools/split-scenes';

// Import resources
import { formatPromptsAsText } from '@/lib/mcp/resources/prompts';
import { formatStylesAsText } from '@/lib/mcp/resources/styles';
// Import prompt template resources
import { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import {
  getAudioDesignPrompt,
  getCharacterExtractionPrompt,
  getMotionPromptGenerationPrompt,
  getSceneSplittingPrompt,
  getVisualPromptGenerationPrompt,
} from '@/lib/mcp/resources/prompt-templates';
import { Scene } from '@/lib/script';
import { generationMotionOptionsSchema } from '@/lib/services/motion.service';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';

// Get all style names for enum validation - ensure it's a proper tuple
const getAllStyleNames = (): [string, ...string[]] => {
  const names = DEFAULT_STYLE_TEMPLATES.map((s) => s.name);
  if (names.length === 0) {
    throw new Error('No style templates available');
  }
  return names as [string, ...string[]];
};

const handler = createMcpHandler(
  async (server) => {
    // Register tools
    server.registerTool(
      'generate_image',
      {
        title: 'Generate Image',
        description:
          'Generate a single cinematic image with a director style applied',
        inputSchema: {
          prompt: z
            .string()
            .describe('The image prompt describing what you want to generate'),
          style: z.enum(getAllStyleNames()).describe('Director style to apply'),
          model: z
            .enum([
              'nano_banana',
              'nano_banana_pro',
              'flux_schnell',
              'flux_dev',
              'flux_pro',
              'flux_pro_v1_1_ultra',
              'flux_krea_lora',
              'sdxl_lightning',
              'sdxl',
              'imagen4_preview_ultra',
              'recraft_v3',
              'hidream_i1_full',
            ])
            .optional()
            .describe('Image generation model (default: nano_banana_pro)'),
          imageSize: z
            .enum(['square_hd', 'portrait_16_9', 'landscape_16_9'])
            .optional()
            .describe('Image dimensions'),
          numImages: z
            .number()
            .int()
            .min(1)
            .max(4)
            .optional()
            .describe('Number of images to generate (1-4)'),
        }, // ZodRawShape - Zod v4 types are incompatible but runtime works correctly
      },
      async (args: {
        prompt: string;
        style: string;
        model?: string;
        imageSize?: 'square_hd' | 'portrait_16_9' | 'landscape_16_9';
        numImages?: number;
      }) => {
        console.log(`[MCP] Tool called: generate_image`);
        const result = await generateImageTool({
          prompt: args.prompt,
          style: args.style,
          model: args.model,
          imageSize: args.imageSize,
          numImages: args.numImages,
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
      'analyze_script',
      {
        description:
          'Analyze a script and break it down into scenes with visual and motion prompts',
        inputSchema: {
          script: z.string().describe('The script content to analyze'),
          style: z.enum(getAllStyleNames()).describe('Director style to apply'),
          aspectRatio: z
            .string()
            .optional()
            .default('16:9')
            .describe('Aspect ratio (e.g., 16:9, 9:16)'),
        }, // ZodRawShape - Zod v4 types are incompatible but runtime works correctly
      },
      async (args: { script: string; style: string; aspectRatio: string }) => {
        console.log(`[MCP] Tool called: analyze_script`);
        const result = await analyzeScriptTool({
          script: args.script,
          style: args.style,
          aspectRatio: args.aspectRatio,
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
      'generate_frames',
      {
        description: 'Generate images for all scenes from script analysis',
        inputSchema: {
          scenes: z
            .array(z.record(z.string(), z.unknown()))
            .describe('Array of scenes from analyze_script output'),
          model: z
            .string()
            .optional()
            .default('flux_pro')
            .describe('Image generation model ID'),
          imageSize: z
            .enum(['square_hd', 'portrait_16_9', 'landscape_16_9'])
            .optional()
            .describe('Image dimensions'),
        }, // ZodRawShape - Zod v4 types are incompatible but runtime works correctly
      },
      async (args) => {
        console.log(`[MCP] Tool called: generate_frames`);
        const result = await generateFramesTool({
          scenes: args.scenes as Scene[],
          model: args.model,
          imageSize: args.imageSize,
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
      'generate_motion',
      {
        description: 'Convert image to video with camera movement',
        inputSchema: generationMotionOptionsSchema, // ZodRawShape - Zod v4 types are incompatible but runtime works correctly
      },
      async (args) => {
        console.log(`[MCP] Tool called: generate_motion`);
        const result = await generateMotionTool({
          imageUrl: args.imageUrl,
          prompt: args.prompt,
          model: args.model,
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

    // Register granular phase tools
    server.registerTool(
      'split_scenes',
      {
        description:
          'Phase 1: Split a script into logical scenes with metadata (use this for step-by-step workflow)',
        inputSchema: {
          script: z.string().describe('Script content to analyze'),
          aspectRatio: z
            .enum(['16:9', '9:16', '1:1', '21:9'])
            .optional()
            .default('16:9')
            .describe('Aspect ratio for the project'),
        },
      },
      async (args) => {
        console.log(`[MCP] Tool called: split_scenes`);
        const result = await splitScenesTool({
          script: args.script,
          aspectRatio: args.aspectRatio,
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
      'extract_characters',
      {
        description:
          'Phase 2: Extract character bible from scenes (use this for step-by-step workflow)',
        inputSchema: {
          scenes: z
            .array(z.record(z.string(), z.unknown()))
            .describe('Array of scenes from split_scenes output'),
        },
      },
      async (args) => {
        console.log(`[MCP] Tool called: extract_characters`);
        const result = await extractCharactersTool({
          scenes: args.scenes as Scene[],
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
        inputSchema: {
          scenes: z
            .array(z.record(z.string(), z.unknown()))
            .describe('Array of scenes from split_scenes output'),
          characterBible: z
            .array(z.record(z.string(), z.unknown()))
            .describe('Character bible from extract_characters output'),
          style: z.enum(getAllStyleNames()).describe('Director style to apply'),
        },
      },
      async (args) => {
        console.log(`[MCP] Tool called: generate_visual_prompts`);
        const result = await generateVisualPromptsTool({
          scenes: args.scenes as Scene[],
          characterBible:
            args.characterBible as unknown as CharacterBibleEntry[],
          style: args.style,
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
        inputSchema: {
          scenes: z
            .array(z.record(z.string(), z.unknown()))
            .describe(
              'Array of scenes with visual prompts (from generate_visual_prompts output)'
            ),
        },
      },
      async (args) => {
        console.log(`[MCP] Tool called: generate_motion_prompts`);
        const result = await generateMotionPromptsTool({
          scenes: args.scenes as Scene[],
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
        inputSchema: {
          scenes: z
            .array(z.record(z.string(), z.unknown()))
            .describe(
              'Array of scenes with visual and motion prompts (from generate_motion_prompts output)'
            ),
        },
      },
      async (args) => {
        console.log(`[MCP] Tool called: design_audio`);
        const result = await designAudioTool({
          scenes: args.scenes as Scene[],
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

    server.resource('prompts', 'velro://prompts', async () => ({
      contents: [
        {
          uri: 'velro://prompts',
          mimeType: 'text/plain',
          text: formatPromptsAsText(),
        },
      ],
    }));

    // Register prompt templates as MCP prompts (for Prompts tab in Inspector)
    server.registerPrompt(
      'scene-splitting',
      {
        title: 'Scene Splitting Prompt',
        description:
          'Phase 1: System prompt template for splitting scripts into logical scenes with metadata',
      },
      async () => {
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: getSceneSplittingPrompt(),
              },
            },
          ],
        };
      }
    );

    server.registerPrompt(
      'character-extraction',
      {
        title: 'Character Extraction Prompt',
        description:
          'Phase 2: System prompt template for extracting character bible from scenes',
      },
      async () => {
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: getCharacterExtractionPrompt(),
              },
            },
          ],
        };
      }
    );

    server.registerPrompt(
      'visual-generation',
      {
        title: 'Visual Prompt Generation',
        description:
          'Phase 3: System prompt template for generating visual prompts with director style',
      },
      async () => {
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: getVisualPromptGenerationPrompt(),
              },
            },
          ],
        };
      }
    );

    server.registerPrompt(
      'motion-generation',
      {
        title: 'Motion Prompt Generation',
        description:
          'Phase 4: System prompt template for generating motion prompts for video generation',
      },
      async () => {
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: getMotionPromptGenerationPrompt(),
              },
            },
          ],
        };
      }
    );

    server.registerPrompt(
      'audio-design',
      {
        title: 'Audio Design Prompt',
        description:
          'Phase 5: System prompt template for generating audio design specifications',
      },
      async () => {
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: getAudioDesignPrompt(),
              },
            },
          ],
        };
      }
    );

    // Also register as resources for direct access
    server.resource(
      'prompt-scene-splitting',
      'velro://prompts/scene-splitting',
      async () => ({
        contents: [
          {
            uri: 'velro://prompts/scene-splitting',
            mimeType: 'text/plain',
            text: getSceneSplittingPrompt(),
          },
        ],
      })
    );

    server.resource(
      'prompt-character-extraction',
      'velro://prompts/character-extraction',
      async () => ({
        contents: [
          {
            uri: 'velro://prompts/character-extraction',
            mimeType: 'text/plain',
            text: getCharacterExtractionPrompt(),
          },
        ],
      })
    );

    server.resource(
      'prompt-visual-generation',
      'velro://prompts/visual-generation',
      async () => ({
        contents: [
          {
            uri: 'velro://prompts/visual-generation',
            mimeType: 'text/plain',
            text: getVisualPromptGenerationPrompt(),
          },
        ],
      })
    );

    server.resource(
      'prompt-motion-generation',
      'velro://prompts/motion-generation',
      async () => ({
        contents: [
          {
            uri: 'velro://prompts/motion-generation',
            mimeType: 'text/plain',
            text: getMotionPromptGenerationPrompt(),
          },
        ],
      })
    );

    server.resource(
      'prompt-audio-design',
      'velro://prompts/audio-design',
      async () => ({
        contents: [
          {
            uri: 'velro://prompts/audio-design',
            mimeType: 'text/plain',
            text: getAudioDesignPrompt(),
          },
        ],
      })
    );
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

export async function OPTIONS() {
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

export async function GET(request: Request) {
  console.log('[MCP Route] GET request:', request.url);
  try {
    const response = await handler(request);
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

export async function POST(request: Request) {
  console.log('[MCP Route] POST request:', request.url);
  try {
    const response = await handler(request);
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

export async function DELETE(request: Request) {
  console.log('[MCP Route] DELETE request:', request.url);
  try {
    const response = await handler(request);
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
