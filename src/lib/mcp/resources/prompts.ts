/**
 * Prompts MCP Resource
 * Reference information about the prompt templates
 */

export type PromptsResourceContent = {
  phases: Array<{
    phase: number;
    name: string;
    description: string;
    outputs: string;
  }>;
};

/**
 * Get prompts resource content
 */
export function getPromptsResource(): PromptsResourceContent {
  return {
    phases: [
      {
        phase: 1,
        name: 'Scene Splitting',
        description:
          'Analyzes the script and breaks it into logical scenes with metadata',
        outputs:
          'scenes array with scene IDs, titles, locations, timing, and original script extracts',
      },
      {
        phase: 2,
        name: 'Character Extraction',
        description:
          'Identifies all characters and builds a Character Bible for visual consistency',
        outputs:
          'characterBible array with complete physical descriptions, clothing, and consistency tags',
      },
      {
        phase: 3,
        name: 'Visual Prompt Generation',
        description:
          'Creates detailed image generation prompts with director style applied',
        outputs:
          'visual prompts with camera angles, mood variants, and complete self-contained descriptions',
      },
      {
        phase: 4,
        name: 'Motion Prompt Generation',
        description: 'Adds camera movement descriptions for video generation',
        outputs:
          'motion prompts with movement styles (static, moderate, dynamic)',
      },
      {
        phase: 5,
        name: 'Audio Design',
        description:
          'Designs music, sound effects, dialogue, and ambient audio for each scene',
        outputs:
          'audioDesign with music presence, sound effects, dialogue lines, and ambient atmosphere',
      },
    ],
  };
}

/**
 * Format prompts as readable text
 */
export function formatPromptsAsText(): string {
  const content = getPromptsResource();
  const lines = [
    '# Velro Script Analysis Workflow',
    '',
    'The analyze_script tool runs a 5-phase progressive analysis pipeline:',
    '',
  ];

  content.phases.forEach((phase) => {
    lines.push(`## Phase ${phase.phase}: ${phase.name}`);
    lines.push('');
    lines.push(`**Description:** ${phase.description}`);
    lines.push('');
    lines.push(`**Outputs:** ${phase.outputs}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  lines.push('## Output Format');
  lines.push('');
  lines.push('The complete output is a SceneAnalysis object with:');
  lines.push('- `status`: "success" | "error" | "rejected"');
  lines.push('- `projectMetadata`: Title, aspect ratio, generation timestamp');
  lines.push(
    '- `characterBible`: Array of character profiles for visual consistency'
  );
  lines.push(
    '- `scenes`: Array of scene objects with all prompts, variants, and audio design'
  );
  lines.push('');
  lines.push(
    'Each scene includes: originalScript, metadata, variants (camera/movement/mood), prompts (visual/motion), audioDesign, and continuity tags.'
  );

  return lines.join('\n');
}

/**
 * Resource description for MCP
 */
export const promptsResourceDescription = {
  uri: 'velro://prompts',
  name: 'Prompt Templates Reference',
  description:
    'Documentation of the 5-phase script analysis workflow and output format',
  mimeType: 'text/plain',
};
