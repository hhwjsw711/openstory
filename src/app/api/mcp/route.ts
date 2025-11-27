/**
 * MCP Server Route Handler
 * Uses mcp-handler for Streamable HTTP transport (protocol 2025-06-18)
 */

import { isLocalDevelopment } from '@/lib/utils/environment';
import { createMcpHandler } from 'mcp-handler';
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
import { formatPromptsAsText } from '@/lib/mcp/resources/prompts';
import { formatStylesAsText } from '@/lib/mcp/resources/styles';
// Import prompt template resources
import {
  getAudioDesignPrompt,
  getCharacterExtractionPrompt,
  getMotionPromptGenerationPrompt,
  getSceneSplittingPrompt,
  getVisualPromptGenerationPrompt,
} from '@/lib/mcp/resources/prompt-templates';
import { generationMotionOptionsSchema } from '@/lib/services/motion.service';

const handler = createMcpHandler(
  async (server) => {
    // Register tools
    server.registerTool(
      'generate_image',
      {
        title: 'Generate Image',
        description:
          'Generate a single cinematic image with a director style applied',
        inputSchema: generateImageInputSchema, // ZodRawShape - Zod v4 types are incompatible but runtime works correctly
      },
      async (args) => {
        console.log(`[MCP] Tool called: generate_image`);
        const result = await generateImageTool(args);
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
