/**
 * Styles MCP Resource
 * Lists all available director DNA styles from Velro templates
 */

import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';

type StylesResourceContent = {
  styles: typeof DEFAULT_STYLE_TEMPLATES;
  totalStyles: number;
};

/**
 * Get styles resource content
 */
export function getStylesResource(): StylesResourceContent {
  return {
    styles: DEFAULT_STYLE_TEMPLATES,
    totalStyles: DEFAULT_STYLE_TEMPLATES.length,
  };
}

/**
 * Format styles as readable text
 */
export function formatStylesAsText(): string {
  const lines = [
    '# Velro Director DNA Styles',
    '',
    `Total Styles: ${DEFAULT_STYLE_TEMPLATES.length}`,
    '',
    '---',
    '',
  ];

  DEFAULT_STYLE_TEMPLATES.forEach((style) => {
    lines.push(`## ${style.name}`);
    lines.push('');
    lines.push(`**Category:** ${style.category}`);
    lines.push(`**Description:** ${style.description}`);
    lines.push('');
    lines.push('**Configuration:**');
    lines.push(`- Art Style: ${style.config.artStyle}`);
    lines.push(`- Lighting: ${style.config.lighting}`);
    lines.push(`- Camera Work: ${style.config.cameraWork}`);
    lines.push(`- Mood: ${style.config.mood}`);
    lines.push(`- Color Grading: ${style.config.colorGrading}`);
    lines.push(`- Color Palette: ${style.config.colorPalette.join(', ')}`);
    lines.push(`- Reference Films: ${style.config.referenceFilms.join(', ')}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Resource description for MCP
 */
export const stylesResourceDescription = {
  uri: 'velro://styles',
  name: 'Director DNA Styles',
  description:
    'Complete catalog of all available director styles with their configuration details',
  mimeType: 'text/plain',
};
