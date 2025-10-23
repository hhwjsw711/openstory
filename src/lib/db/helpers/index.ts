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
  getUserTeam,
  getUserDefaultTeam,
  canAccessTeam,
  canManageTeam,
  getTeamMembers,
  getUserTeams,
  requireTeamAccess,
  requireTeamManagement,
  type UserTeamMembership,
  type TeamMemberWithDetails,
} from './team-permissions';

// Storage Helpers
export {
  getStorageClient,
  uploadFile,
  getPublicUrl,
  getSignedUrl,
  deleteFile,
  deleteFiles,
  listFiles,
  moveFile,
  copyFile,
  fileExists,
  STORAGE_BUCKETS,
  type StorageBucket,
  type UploadResult,
} from './storage';

// Transaction Utilities
export {
  withTransaction,
  withBatchTransaction,
  withRetryTransaction,
  withIsolationLevel,
  withSavepoint,
  type TransactionCallback,
  type IsolationLevel,
} from './transactions';

// Common Queries
export {
  getSequenceWithFrames,
  getTeamSequences,
  getTeamStyles,
  getTeamCharacters,
  getTeamVfx,
  getTeamAudio,
  getFrameById,
  getSequenceFrames,
  getSequenceById,
  getStyleById,
  getCharacterById,
  getTeamById,
  getTeamLibrary,
  countTeamSequences,
  getSequencesWithoutStyle,
  getRecentlyUsedStyles,
  type SequenceWithFrames,
} from './queries';
