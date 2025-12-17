/**
 * Hook for fetching sequence characters (talent)
 */

import { useQuery } from '@tanstack/react-query';
import { getSequenceCharactersFn } from '@/functions/sequence-characters';
import type { SequenceCharacter } from '@/lib/db/schema';

export const sequenceCharacterKeys = {
  all: ['sequence-characters'] as const,
  list: (sequenceId: string) =>
    [...sequenceCharacterKeys.all, 'list', sequenceId] as const,
};

export function useSequenceCharacters(sequenceId: string) {
  return useQuery<SequenceCharacter[]>({
    queryKey: sequenceCharacterKeys.list(sequenceId),
    queryFn: async () => {
      return getSequenceCharactersFn({ data: { sequenceId } });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - characters don't change often
    enabled: !!sequenceId,
  });
}
