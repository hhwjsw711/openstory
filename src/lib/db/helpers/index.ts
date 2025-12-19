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

// Talent Library Operations
export {
  createTalent,
  createTalentMediaRecord,
  createTalentSheet,
  deleteTalent,
  deleteTalentMediaRecord,
  deleteTalentSheet,
  getTeamTalent,
  getTalentById,
  getTalentSheetById,
  getTalentWithRelations,
  toggleTalentFavorite,
  updateTalent,
  updateTalentSheet,
} from './talent';
