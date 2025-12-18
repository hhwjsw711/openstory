/**
 * Hook for fetching sequence characters
 */

import { useQuery } from '@tanstack/react-query';
import { getSequenceCharactersFn } from '@/functions/sequence-characters';
import type { Character } from '@/lib/db/schema';

// Re-export Character as SequenceCharacter for backward compatibility
export type SequenceCharacter = Character;

export const sequenceCharacterKeys = {
  all: ['sequence-characters'] as const,
  list: (sequenceId: string) =>
    [...sequenceCharacterKeys.all, 'list', sequenceId] as const,
};

export function useSequenceCharacters(sequenceId: string) {
  return useQuery<Character[]>({
    queryKey: sequenceCharacterKeys.list(sequenceId),
    queryFn: async () => {
      return getSequenceCharactersFn({ data: { sequenceId } });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - characters don't change often
    enabled: !!sequenceId,
  });
}
