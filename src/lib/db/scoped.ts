/**
 * Scoped Database Context
 * Factory that returns team-scoped query methods, auto-injecting teamId.
 * Sequence-scoped and locationSheet operations use inline Drizzle queries.
 */

import { eq } from 'drizzle-orm';
import { getDb } from '#db-client';
import { getSequencesByTeam, createSequence } from '@/lib/db/helpers/sequences';
import type { SequenceStatus } from '@/lib/db/schema/sequences';
import type { MergedVideoStatus, MusicStatus } from '@/lib/db/schema/sequences';
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
  updateLibraryLocation,
} from '@/lib/db/helpers/location-library';
import { getCharacterById } from '@/lib/db/helpers/sequence-characters';
import { sequences, locationSheets, locationLibrary } from '@/lib/db/schema';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import type {
  NewLocationSheet,
  NewStyle,
  NewTalent,
  NewLibraryLocation,
  Style,
  Talent,
} from '@/lib/db/schema';

export type MusicFieldsUpdate = {
  musicStatus?: MusicStatus;
  musicModel?: string;
  musicError?: string | null;
  musicUrl?: string;
  musicPath?: string;
  musicGeneratedAt?: Date;
};

export type MergedVideoFieldsUpdate = {
  mergedVideoStatus?: MergedVideoStatus;
  mergedVideoError?: string | null;
  mergedVideoUrl?: string | null;
  mergedVideoPath?: string | null;
  mergedVideoGeneratedAt?: Date;
};

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

    sequence: (sequenceId: string) => ({
      sequenceId,

      updateStatus: async (status: SequenceStatus, error?: string | null) => {
        await getDb()
          .update(sequences)
          .set({ status, statusError: error ?? null, updatedAt: new Date() })
          .where(eq(sequences.id, sequenceId));
      },

      updateMusicFields: async (fields: MusicFieldsUpdate) => {
        await getDb()
          .update(sequences)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(sequences.id, sequenceId));
      },

      updateMergedVideoFields: async (fields: MergedVideoFieldsUpdate) => {
        await getDb()
          .update(sequences)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(sequences.id, sequenceId));
      },

      getMusicStatus: async () => {
        const [row] = await getDb()
          .select({
            musicStatus: sequences.musicStatus,
            musicUrl: sequences.musicUrl,
          })
          .from(sequences)
          .where(eq(sequences.id, sequenceId));
        return row;
      },

      getMergedVideoStatus: async () => {
        const [row] = await getDb()
          .select({
            mergedVideoStatus: sequences.mergedVideoStatus,
            mergedVideoUrl: sequences.mergedVideoUrl,
          })
          .from(sequences)
          .where(eq(sequences.id, sequenceId));
        return row;
      },
    }),

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

    locationSheets: {
      list: (locationId: string) =>
        getDb()
          .select()
          .from(locationSheets)
          .where(eq(locationSheets.locationId, locationId)),

      insert: (sheets: NewLocationSheet[]) =>
        sheets.length === 0
          ? Promise.resolve([])
          : getDb().insert(locationSheets).values(sheets).returning(),

      delete: async (sheetId: string) => {
        await getDb()
          .delete(locationSheets)
          .where(eq(locationSheets.id, sheetId));
      },

      getWithLocation: async (sheetId: string) => {
        const result = await getDb()
          .select({ sheet: locationSheets, location: locationLibrary })
          .from(locationSheets)
          .innerJoin(
            locationLibrary,
            eq(locationSheets.locationId, locationLibrary.id)
          )
          .where(eq(locationSheets.id, sheetId));
        return result[0] ?? null;
      },

      promoteDefault: async (locationId: string) => {
        const [nextSheet] = await getDb()
          .select()
          .from(locationSheets)
          .where(eq(locationSheets.locationId, locationId))
          .limit(1);

        if (nextSheet) {
          await getDb()
            .update(locationSheets)
            .set({ isDefault: true })
            .where(eq(locationSheets.id, nextSheet.id));

          if (nextSheet.imageUrl) {
            await updateLibraryLocation(locationId, {
              referenceImageUrl: nextSheet.imageUrl,
              referenceImagePath: nextSheet.imagePath,
            });
          }
        } else {
          await updateLibraryLocation(locationId, {
            referenceImageUrl: null,
            referenceImagePath: null,
          });
        }
      },
    },

    characters: {
      getById: (id: string) => getCharacterById(id),
    },

    library: {
      getAll: () => getTeamLibrary(teamId),
    },
  };
}

export type ScopedDb = ReturnType<typeof createScopedDb>;
