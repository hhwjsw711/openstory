/**
 * Drizzle ORM Schema Index
 * Central export point for all database schemas and relations
 */

// Better Auth tables
export { account, session, user, verification } from './auth';

export type { Account, Session, User, Verification } from './auth';

// Teams
export { teamInvitations, teamMembers, teams } from './teams';

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
export { sequences } from './sequences';

export type { NewSequence, Sequence, SequenceStatus } from './sequences';

// Frames
export { frames } from './frames';

export type { Frame, NewFrame } from './frames';

// Sequence Characters (legacy - to be deprecated)
export { sequenceCharacters } from './sequence-characters';

export type {
  NewSequenceCharacter,
  SequenceCharacter,
  SheetStatus,
} from './sequence-characters';

// Character Library (new)
export {
  characterMedia,
  characterSheets,
  libraryCharacters,
  sequenceCharacterUsages,
} from './characters';

export type {
  CharacterMediaRecord,
  CharacterMediaType,
  CharacterSheet,
  CharacterSheetSource,
  LibraryCharacter,
  LibraryCharacterWithRelations,
  LibraryCharacterWithSheets,
  NewCharacterMedia,
  NewCharacterSheet,
  NewLibraryCharacter,
  NewSequenceCharacterUsage,
  SequenceCharacterUsage,
} from './characters';

// Library Resources
export { audio, styles, vfx } from './libraries';

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

// Audit
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
  libraryCharacters,
  libraryCharactersRelations,
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

// Import statements (not exported, just for local use)
import { account, session, user, verification } from './auth';

import {
  teamInvitations,
  teamInvitationsRelations,
  teamMembers,
  teamMembersRelations,
  teams,
  teamsRelations,
} from './teams';

import { sequences, sequencesRelations } from './sequences';

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
  libraryCharacters,
  libraryCharactersRelations,
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
