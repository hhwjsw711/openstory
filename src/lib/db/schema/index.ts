/**
 * Drizzle ORM Schema Index
 * Central export point for all database schemas and relations
 */

import { relations } from 'drizzle-orm';

// Import all schema components first (required for schema object)
import {
  account,
  passkey,
  passkeyRelations,
  session,
  user,
  verification,
} from './auth';

import {
  teamInvitations,
  teamInvitationsRelations,
  teamMembers,
  teamMembersRelations,
  teams,
  teamsRelations,
} from './teams';

// NOTE: sequences imported without relations - defined below to avoid circular dependency
import { sequences } from './sequences';

import { frames, framesRelations } from './frames';

import {
  sequenceCharacters,
  sequenceCharactersRelations,
} from './sequence-characters';

import {
  characterMedia,
  characterMediaRelations,
  characterSheets,
  characterSheetsRelations,
  characters,
  charactersRelations,
  sequenceCharacterUsages,
  sequenceCharacterUsagesRelations,
} from './characters';

import {
  audio,
  audioRelations,
  styleAdaptations,
  styleAdaptationsRelations,
  styles,
  stylesRelations,
  vfx,
  vfxRelations,
} from './libraries';

import {
  falRequests,
  falRequestsRelations,
  letzaiRequests,
  letzaiRequestsRelations,
} from './tracking';

import {
  credits,
  creditsRelations,
  transactions,
  transactionsRelations,
} from './credits';

import { scriptAnalysisAudit } from './audit';

// ============================================================================
// Relations defined here to avoid circular dependencies
// ============================================================================

/**
 * Sequences relations - defined here because frames.ts imports sequences
 * for FK reference, creating a circular dependency if defined in sequences.ts
 */
export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  team: one(teams, {
    fields: [sequences.teamId],
    references: [teams.id],
  }),
  user_createdBy: one(user, {
    fields: [sequences.createdBy],
    references: [user.id],
    relationName: 'sequences_createdBy_users_id',
  }),
  user_updatedBy: one(user, {
    fields: [sequences.updatedBy],
    references: [user.id],
    relationName: 'sequences_updatedBy_users_id',
  }),
  style: one(styles, {
    fields: [sequences.styleId],
    references: [styles.id],
  }),
  frames: many(frames),
}));

// Better Auth tables
export { account, passkey, session, user, verification };

export type { Account, Passkey, Session, User, Verification } from './auth';

// Teams
export { teamInvitations, teamMembers, teams };

export type {
  InvitationStatus,
  NewTeam,
  NewTeamInvitation,
  NewTeamMember,
  Team,
  TeamInvitation,
  TeamMember,
  TeamMemberRole,
} from './teams';

// Sequences
export { sequences };

export type { NewSequence, Sequence, SequenceStatus } from './sequences';

// Frames
export { frames };

export type { Frame, NewFrame } from './frames';

// Sequence Characters (legacy - to be deprecated)
export { sequenceCharacters };

export type {
  NewSequenceCharacter,
  SequenceCharacter,
  SheetStatus,
} from './sequence-characters';

// Character Library (new)
export { characterMedia, characterSheets, characters, sequenceCharacterUsages };

export type {
  CharacterMediaRecord,
  CharacterMediaType,
  CharacterSheet,
  CharacterSheetSource,
  Character,
  CharacterWithRelations,
  CharacterWithSheets,
  NewCharacterMedia,
  NewCharacterSheet,
  NewCharacter,
  NewSequenceCharacterUsage,
  SequenceCharacterUsage,
} from './characters';

// Library Resources
export { audio, styles, vfx };

export type {
  Audio,
  NewAudio,
  NewStyle,
  NewStyleAdaptation,
  NewVfx,
  Style,
  StyleAdaptation,
  Vfx,
} from './libraries';

// API Request Tracking
export type {
  FalRequest,
  FalRequestStatus,
  LetzaiRequest,
  LetzaiRequestStatus,
  NewFalRequest,
  NewLetzaiRequest,
} from './tracking';

// Credits and Transactions
export type {
  Credit,
  NewCredit,
  NewTransaction,
  Transaction,
  TransactionType,
} from './credits';

/**
 * Complete schema object for Drizzle client initialization
 * Import this when creating your Drizzle instance
 */
export const schema = {
  // Better Auth
  user,
  session,
  account,
  verification,
  passkey,
  passkeyRelations,

  // Teams
  teams,
  teamMembers,
  teamInvitations,
  teamsRelations,
  teamMembersRelations,
  teamInvitationsRelations,

  // Sequences
  sequences,
  frames,
  sequencesRelations,
  framesRelations,

  // Sequence Characters (legacy)
  sequenceCharacters,
  sequenceCharactersRelations,

  // Character Library (new)
  characters,
  charactersRelations,
  characterSheets,
  characterSheetsRelations,
  characterMedia,
  characterMediaRelations,
  sequenceCharacterUsages,
  sequenceCharacterUsagesRelations,

  // Libraries
  styles,
  styleAdaptations,
  vfx,
  audio,
  stylesRelations,
  styleAdaptationsRelations,
  vfxRelations,
  audioRelations,

  // Tracking
  falRequests,
  letzaiRequests,
  falRequestsRelations,
  letzaiRequestsRelations,

  // Credits
  credits,
  transactions,
  creditsRelations,
  transactionsRelations,

  // Audit
  scriptAnalysisAudit,
};
