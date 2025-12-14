/**
 * Database Helpers
 * Centralized exports for all database helper utilities
 *
 * Import from this file to access all helper functions:
 * @example
 * ```ts
 * import { getUserTeam, uploadFile, withTransaction, getSequenceWithFrames } from '@/lib/db/helpers';
 * ```
 */

// Team Permission Helpers
export {
  canAccessTeam,
  getUserDefaultTeam,
  getUserTeams,
  requireTeamManagement,
} from './team-permissions';

// User and Team Creation
export { ensureUserAndTeam } from './ensure-user-team';

// Storage Helpers
// Common Queries
export {
  getPublicStyles,
  getStyleById,
  getTeamAndPublicStyles,
} from './queries';

// Frame Operations

// Sequence Character Operations

// Character Library Operations
export {
  createCharacter,
  createCharacterMediaRecord,
  createCharacterSheet,
  deleteCharacter,
  deleteCharacterMediaRecord,
  deleteCharacterSheet,
  getCharacterById,
  getCharactersForSequence,
  getCharacterSheetById,
  getCharacterWithRelations,
  getTeamCharacters,
  toggleCharacterFavorite,
  updateCharacter,
  updateCharacterSheet,
} from './characters';
