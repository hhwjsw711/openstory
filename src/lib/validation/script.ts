/**
 * Client-side script validation utilities
 */

export interface ScriptValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  estimatedFrames: number;
  estimatedDuration: number; // in seconds
}

const VALIDATION_DELAY = 300; // ms

/**
 * Validate script and provide feedback
 */
export async function validateScript(
  script: string
): Promise<ScriptValidationResult> {
  // Simulate processing time for UX
  await new Promise((resolve) => setTimeout(resolve, VALIDATION_DELAY));

  const trimmedScript = script.trim();
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Basic validation
  if (!trimmedScript) {
    errors.push('Script cannot be empty');
  } else if (trimmedScript.length < 10) {
    errors.push('Script must be at least 10 characters long');
  } else if (trimmedScript.length > 10000) {
    errors.push('Script must be 10,000 characters or less');
  }

  // Content warnings and suggestions
  if (trimmedScript.length > 0) {
    const wordCount = trimmedScript.split(/\s+/).length;
    const sentenceCount = trimmedScript
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0).length;

    if (wordCount < 50) {
      warnings.push('Short scripts may generate fewer frames');
    }

    if (wordCount > 500) {
      warnings.push('Long scripts may take more time to process');
    }

    if (sentenceCount < 3) {
      suggestions.push('Consider adding more detail for richer visuals');
    }

    if (!trimmedScript.match(/[.!?]/)) {
      suggestions.push('Add punctuation to help identify scene breaks');
    }

    // Check for dialogue
    if (trimmedScript.includes('"') || trimmedScript.includes("'")) {
      suggestions.push(
        'Dialogue detected - consider describing character expressions'
      );
    }

    // Check for action words
    const actionWords = [
      'runs',
      'jumps',
      'fights',
      'flies',
      'explodes',
      'crashes',
    ];
    const hasAction = actionWords.some((word) =>
      trimmedScript.toLowerCase().includes(word)
    );

    if (hasAction) {
      suggestions.push(
        'Action sequences detected - great for dynamic visuals!'
      );
    }
  }

  // Estimate frames and duration
  const estimatedFrames =
    errors.length > 0 ? 0 : Math.max(1, Math.ceil(trimmedScript.length / 100));
  const estimatedDuration = estimatedFrames * 5; // 5 seconds per frame

  return {
    success: errors.length === 0,
    errors,
    warnings,
    suggestions,
    estimatedFrames,
    estimatedDuration,
  };
}
