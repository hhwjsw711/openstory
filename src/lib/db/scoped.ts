/**
 * Scoped Database Context
 * Factory that returns team-scoped query methods, auto-injecting teamId.
 * Delegates to existing db helpers — no new query logic.
 */

import { getSequencesByTeam, createSequence } from '@/lib/db/helpers/sequences';
import {
  getTeamTalent,
  getTalentByIds,
  createTalent,
  updateTalent,
  deleteTalent,
  toggleTalentFavorite,
} from '@/lib/db/helpers/talent';
import {
  getTeamAndPublicStyles,
  getTeamLibrary,
} from '@/lib/db/helpers/queries';
import { createStyle, updateStyle, deleteStyle } from '@/lib/db/helpers/styles';
import {
  getTeamLibraryLocations,
  searchLibraryLocations,
  createLibraryLocation,
  getLibraryLocationsWithReferences,
} from '@/lib/db/helpers/location-library';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import type {
  NewStyle,
  NewTalent,
  NewLibraryLocation,
  Style,
  Talent,
} from '@/lib/db/schema';

export function createScopedDb(teamId: string) {
  return {
    teamId,

    sequences: {
      list: () => getSequencesByTeam(teamId),

      create: (params: {
        userId: string;
        title: string;
        script?: string | null;
        styleId: string;
        aspectRatio?: AspectRatio;
        analysisModel: string;
        imageModel?: string;
        videoModel?: string;
        musicModel?: string;
      }) => createSequence({ ...params, teamId }),
    },

    talent: {
      list: (options?: { favoritesOnly?: boolean }) =>
        getTeamTalent(teamId, options),

      getByIds: (ids: string[]) => getTalentByIds(ids, teamId),

      create: (data: Omit<NewTalent, 'teamId'>) =>
        createTalent({ ...data, teamId }),

      update: (
        talentId: string,
        data: Partial<Omit<Talent, 'id' | 'teamId' | 'createdAt' | 'createdBy'>>
      ) => updateTalent(talentId, teamId, data),

      delete: (talentId: string) => deleteTalent(talentId, teamId),

      toggleFavorite: (talentId: string) =>
        toggleTalentFavorite(talentId, teamId),
    },

    styles: {
      list: () => getTeamAndPublicStyles(teamId),

      create: (data: Omit<NewStyle, 'teamId'>) =>
        createStyle({ ...data, teamId }),

      update: (
        styleId: string,
        data: Partial<Omit<Style, 'id' | 'teamId' | 'createdAt' | 'createdBy'>>
      ) => updateStyle(styleId, teamId, data),

      delete: (styleId: string) => deleteStyle(styleId, teamId),
    },

    locations: {
      list: () => getTeamLibraryLocations(teamId),

      search: (query: string, limit?: number) =>
        searchLibraryLocations(teamId, query, limit),

      create: (data: Omit<NewLibraryLocation, 'teamId'>) =>
        createLibraryLocation({ ...data, teamId }),

      withReferences: () => getLibraryLocationsWithReferences(teamId),
    },

    library: {
      getAll: () => getTeamLibrary(teamId),
    },
  };
}

export type ScopedDb = ReturnType<typeof createScopedDb>;
