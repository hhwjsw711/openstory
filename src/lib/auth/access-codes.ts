/**
 * Hard-coded list of valid access codes for signup
 * Add new codes here as needed
 */
export const VALID_ACCESS_CODES = [
  'COSMIC-FALCON-2847',
  'STELLAR-PHOENIX-1923',
  'NEBULA-DRAGON-4156',
  'QUANTUM-TIGER-5739',
  'AURORA-WOLF-8421',
] as const;

/**
 * Validates if a given code is in the list of valid access codes
 * Case-insensitive and trims whitespace
 */
export function isValidAccessCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  const normalizedCode = code.toUpperCase().trim();
  return VALID_ACCESS_CODES.includes(
    normalizedCode as (typeof VALID_ACCESS_CODES)[number]
  );
}
