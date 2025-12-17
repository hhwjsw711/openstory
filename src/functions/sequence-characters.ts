/**
 * Sequence Characters Server Functions
 * Functions for sequence-specific character (talent) operations
 */

import { createServerFn } from '@tanstack/react-start';
import { sequenceAccessMiddleware } from './middleware';
import { getSequenceCharacters } from '@/lib/db/helpers/sequence-characters';

/**
 * Get all characters for a sequence
 * Returns characters extracted from the script with their reference sheets
 */
export const getSequenceCharactersFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .handler(async ({ context }) => {
    return getSequenceCharacters(context.sequence.id);
  });
