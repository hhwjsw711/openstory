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
  canManageTeam,
  getTeamMembers,
  getUserDefaultTeam,
  getUserTeam,
  getUserTeams,
  requireTeamAccess,
  requireTeamManagement,
  type TeamMemberWithDetails,
  type UserTeamMembership,
} from './team-permissions';

// User and Team Creation
export {
  ensureUserAndTeam,
  type EnsureUserTeamResult,
} from './ensure-user-team';

// Storage Helpers
export {
  copyFile,
  deleteFile,
  deleteFiles,
  fileExists,
  getPublicUrl,
  getSignedUrl,
  listFiles,
  moveFile,
  STORAGE_BUCKETS,
  uploadFile,
  type StorageBucket,
  type UploadResult,
} from './storage';

// Common Queries
export {
  countTeamSequences,
  getCharacterById,
  getPublicStyles,
  getRecentlyUsedStyles,
  getSequenceById,
  getSequencesWithoutStyle,
  getSequenceWithFrames,
  getStyleById,
  getTeamAndPublicStyles,
  getTeamAudio,
  getTeamById,
  getTeamCharacters,
  getTeamLibrary,
  getTeamSequences,
  getTeamStyles,
  getTeamVfx,
  type SequenceWithFrames,
} from './queries';

// Frame Operations
export {
  countSequenceFrames,
  createFrame,
  // Bulk Operations
  createFramesBulk,
  deleteFrame,
  deleteFramesBulk,
  deleteSequenceFrames,
  // Core CRUD
  getFrameById,
  getFramesWithoutThumbnails,
  getFramesWithoutVideo,
  // Advanced Queries
  getFrameWithSequence,
  getIncompleteFrames,
  getSequenceFrames,
  markFrameComplete,
  moveFrame,
  // Frame Ordering
  reorderFrames,
  swapFrames,
  updateFrame,
  updateFramesBulk,
  // Status/Content Operations
  updateFrameThumbnail,
  updateFrameVideo,
  type FrameFilters,
  type FrameOrderBy,
  // Types
  type FrameWithSequence,
} from './frames';

// Sequence Character Operations
export {
  createSequenceCharacter,
  createSequenceCharactersBulk,
  deleteSequenceCharacter,
  deleteSequenceCharacters,
  getCharactersNeedingSheets,
  getSequenceCharacterByCharacterId,
  getSequenceCharacterById,
  getSequenceCharacters,
  getSequenceCharactersByIds,
  getSequenceCharactersWithSheets,
  updateCharacterSheet,
  updateSequenceCharacter,
  updateSheetStatus,
} from './sequence-characters';
