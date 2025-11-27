/**
 * Common Query Patterns
 * Frequently used database queries to avoid duplication across API routes
 */

import { getDb } from '#db-client';
import type {
  Audio,
  Character,
  Frame,
  Sequence,
  Style,
  Vfx,
} from '@/lib/db/schema';
import {
  audio,
  characters,
  sequences,
  styles,
  teams,
  vfx,
} from '@/lib/db/schema';
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';

/**
 * Sequence with all its frames
 */
export type SequenceWithFrames = Sequence & {
  frames: Frame[];
  style: Style | null;
};

/**
 * Get a sequence with all its frames
 * Frames are ordered by orderIndex
 *
 * @param sequenceId - The sequence ID
 * @returns Sequence with frames, or null if not found
 *
 * @example
 * ```ts
 * const sequence = await getSequenceWithFrames(sequenceId);
 * if (!sequence) {
 *   return NextResponse.json({ error: 'Not found' }, { status: 404 });
 * }
 * console.log(`Sequence has ${sequence.frames.length} frames`);
 * ```
 */
export async function getSequenceWithFrames(
  sequenceId: string
): Promise<SequenceWithFrames | null> {
  const result = await getDb().query.sequences.findFirst({
    where: eq(sequences.id, sequenceId),
    with: {
      frames: {
        orderBy: (frames, { asc }) => [asc(frames.orderIndex)],
      },
      style: true,
    },
  });

  if (!result) {
    return null;
  }

  return result as SequenceWithFrames;
}

/**
 * Get all sequences for a team
 * Ordered by creation date (newest first)
 *
 * @param teamId - The team ID
 * @param options - Optional filtering and pagination
 * @returns Array of sequences
 *
 * @example
 * ```ts
 * const sequences = await getTeamSequences(teamId, { limit: 10 });
 * ```
 */
export async function getTeamSequences(
  teamId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: 'draft' | 'processing' | 'completed' | 'failed' | 'archived';
  }
): Promise<Sequence[]> {
  const query = getDb()
    .select()
    .from(sequences)
    .where(
      options?.status
        ? and(
            eq(sequences.teamId, teamId),
            eq(sequences.status, options.status)
          )
        : eq(sequences.teamId, teamId)
    )
    .orderBy(desc(sequences.createdAt))
    .$dynamic();

  if (options?.limit) {
    return await query.limit(options.limit).offset(options?.offset ?? 0);
  }

  if (options?.offset) {
    return await query.offset(options.offset);
  }

  return await query;
}

/**
 * Get all styles for a team
 * Includes public styles and team-specific styles
 *
 * @param teamId - The team ID
 * @param options - Optional filtering
 * @returns Array of styles
 *
 * @example
 * ```ts
 * const styles = await getTeamStyles(teamId);
 * const templates = await getTeamStyles(teamId, { templatesOnly: true });
 * ```
 */
export async function getTeamStyles(
  teamId: string,
  options?: {
    templatesOnly?: boolean;
    category?: string;
  }
): Promise<Style[]> {
  // Build where condition - inline to preserve type inference
  // Use relational query API for better type inference
  return await getDb().query.styles.findMany({
    where:
      options?.templatesOnly && options?.category
        ? and(
            eq(styles.teamId, teamId),
            eq(styles.isTemplate, true),
            eq(styles.category, options.category)
          )
        : options?.templatesOnly
          ? and(eq(styles.teamId, teamId), eq(styles.isTemplate, true))
          : options?.category
            ? and(
                eq(styles.teamId, teamId),
                eq(styles.category, options.category)
              )
            : eq(styles.teamId, teamId),
    orderBy: (stylesTable, { desc }) => [
      desc(stylesTable.usageCount),
      asc(stylesTable.createdAt),
    ],
  });
}

/**
 * Get public styles only
 * For users without a team or to show public templates
 *
 * @returns Array of public styles
 *
 * @example
 * ```ts
 * const publicStyles = await getPublicStyles();
 * ```
 */
export async function getPublicStyles(): Promise<Style[]> {
  return await getDb()
    .select()
    .from(styles)
    .where(eq(styles.isPublic, true))
    .orderBy(asc(styles.name));
}

/**
 * Get all styles accessible to a team (team styles + public styles)
 * Combines team-specific and public styles in one call
 *
 * @param teamId - The team ID
 * @returns Array of accessible styles
 *
 * @example
 * ```ts
 * const allStyles = await getTeamAndPublicStyles(teamId);
 * ```
 */
export async function getTeamAndPublicStyles(teamId: string): Promise<Style[]> {
  return await getDb()
    .select()
    .from(styles)
    .where(or(eq(styles.teamId, teamId), eq(styles.isPublic, true)))
    .orderBy(asc(styles.name));
}

/**
 * Get all characters for a team
 *
 * @param teamId - The team ID
 * @returns Array of characters
 *
 * @example
 * ```ts
 * const characters = await getTeamCharacters(teamId);
 * ```
 */
export async function getTeamCharacters(teamId: string): Promise<Character[]> {
  return await getDb()
    .select()
    .from(characters)
    .where(eq(characters.teamId, teamId))
    .orderBy(desc(characters.createdAt));
}

/**
 * Get all VFX presets for a team
 *
 * @param teamId - The team ID
 * @returns Array of VFX presets
 *
 * @example
 * ```ts
 * const vfxPresets = await getTeamVfx(teamId);
 * ```
 */
export async function getTeamVfx(teamId: string): Promise<Vfx[]> {
  return await getDb()
    .select()
    .from(vfx)
    .where(eq(vfx.teamId, teamId))
    .orderBy(desc(vfx.createdAt));
}

/**
 * Get all audio files for a team
 *
 * @param teamId - The team ID
 * @returns Array of audio files
 *
 * @example
 * ```ts
 * const audioFiles = await getTeamAudio(teamId);
 * ```
 */
export async function getTeamAudio(teamId: string): Promise<Audio[]> {
  return await getDb()
    .select()
    .from(audio)
    .where(eq(audio.teamId, teamId))
    .orderBy(desc(audio.createdAt));
}

/**
 * Get a single sequence by ID (without frames)
 *
 * @param sequenceId - The sequence ID
 * @returns Sequence or null if not found
 *
 * @example
 * ```ts
 * const sequence = await getSequenceById(sequenceId);
 * if (!sequence) {
 *   return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
 * }
 * ```
 */
export async function getSequenceById(
  sequenceId: string
): Promise<Sequence | null> {
  const result = await getDb()
    .select()
    .from(sequences)
    .where(eq(sequences.id, sequenceId));
  return result[0] ?? null;
}

/**
 * Get a single style by ID
 *
 * @param styleId - The style ID
 * @returns Style or null if not found
 *
 * @example
 * ```ts
 * const style = await getStyleById(styleId);
 * if (!style) {
 *   return NextResponse.json({ error: 'Style not found' }, { status: 404 });
 * }
 * ```
 */
export async function getStyleById(styleId: string): Promise<Style | null> {
  const result = await getDb()
    .select()
    .from(styles)
    .where(eq(styles.id, styleId));
  return result[0] ?? null;
}

/**
 * Get a single character by ID
 *
 * @param characterId - The character ID
 * @returns Character or null if not found
 *
 * @example
 * ```ts
 * const character = await getCharacterById(characterId);
 * if (!character) {
 *   return NextResponse.json({ error: 'Character not found' }, { status: 404 });
 * }
 * ```
 */
export async function getCharacterById(
  characterId: string
): Promise<Character | null> {
  const result = await getDb()
    .select()
    .from(characters)
    .where(eq(characters.id, characterId));
  return result[0] ?? null;
}

/**
 * Get a team by ID
 *
 * @param teamId - The team ID
 * @returns Team or null if not found
 *
 * @example
 * ```ts
 * const team = await getTeamById(teamId);
 * if (!team) {
 *   return NextResponse.json({ error: 'Team not found' }, { status: 404 });
 * }
 * ```
 */
export async function getTeamById(teamId: string) {
  const result = await getDb().select().from(teams).where(eq(teams.id, teamId));
  return result[0] ?? null;
}

/**
 * Get all library resources for a team
 * Returns all styles, characters, vfx, and audio in a single call
 *
 * @param teamId - The team ID
 * @returns Object with all library resources
 *
 * @example
 * ```ts
 * const library = await getTeamLibrary(teamId);
 * console.log(`Team has ${library.styles.length} styles`);
 * ```
 */
export async function getTeamLibrary(teamId: string): Promise<{
  styles: Style[];
  characters: Character[];
  vfx: Vfx[];
  audio: Audio[];
}> {
  const [stylesList, charactersList, vfxList, audioList] = await Promise.all([
    getTeamStyles(teamId),
    getTeamCharacters(teamId),
    getTeamVfx(teamId),
    getTeamAudio(teamId),
  ]);

  return {
    styles: stylesList,
    characters: charactersList,
    vfx: vfxList,
    audio: audioList,
  };
}

/**
 * Count sequences for a team
 *
 * @param teamId - The team ID
 * @param status - Optional status filter
 * @returns Number of sequences
 *
 * @example
 * ```ts
 * const total = await countTeamSequences(teamId);
 * const processing = await countTeamSequences(teamId, 'processing');
 * ```
 */
export async function countTeamSequences(
  teamId: string,
  status?: 'draft' | 'processing' | 'completed' | 'failed' | 'archived'
): Promise<number> {
  const [result] = await getDb()
    .select({ count: getDb().$count(sequences.id) })
    .from(sequences)
    .where(
      status
        ? and(eq(sequences.teamId, teamId), eq(sequences.status, status))
        : eq(sequences.teamId, teamId)
    );

  return result?.count ?? 0;
}

/**
 * Get sequences without a style assigned
 * Useful for prompting users to select a style
 *
 * @param teamId - The team ID
 * @returns Array of sequences without styles
 *
 * @example
 * ```ts
 * const unstyledSequences = await getSequencesWithoutStyle(teamId);
 * if (unstyledSequences.length > 0) {
 *   console.log('Some sequences need a style!');
 * }
 * ```
 */
export async function getSequencesWithoutStyle(
  teamId: string
): Promise<Sequence[]> {
  return await getDb()
    .select()
    .from(sequences)
    .where(and(eq(sequences.teamId, teamId), isNull(sequences.styleId)))
    .orderBy(desc(sequences.createdAt));
}

/**
 * Get the most recently used styles for a team
 * Based on sequences that use each style
 *
 * @param teamId - The team ID
 * @param limit - Maximum number of styles to return (default: 5)
 * @returns Array of styles ordered by recent usage
 *
 * @example
 * ```ts
 * const recentStyles = await getRecentlyUsedStyles(teamId, 3);
 * ```
 */
export async function getRecentlyUsedStyles(
  teamId: string,
  limit = 5
): Promise<Style[]> {
  // Get styles that have been used in sequences, ordered by most recent use
  const stylesWithUsage = await getDb().query.styles.findMany({
    where: eq(styles.teamId, teamId),
    orderBy: (styles, { desc }) => [desc(styles.usageCount)],
    limit,
  });

  return stylesWithUsage;
}
