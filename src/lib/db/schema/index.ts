/**
 * Drizzle ORM Schema Index
 * Central export point for all database schemas and relations
 */

// Better Auth tables
export {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from './auth';

export type {
  Account,
  NewAccount,
  NewSession,
  NewUser,
  NewVerification,
  Session,
  User,
  Verification,
} from './auth';

// Teams
export {
  INVITATION_STATUSES,
  teamInvitations,
  teamInvitationsRelations,
  TEAM_MEMBER_ROLES,
  teamMembers,
  teamMembersRelations,
  teams,
  teamsRelations,
} from './teams';

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
export {
  FRAME_GENERATION_STATUSES,
  frames,
  framesRelations,
  sequences,
  sequencesRelations,
  SEQUENCE_STATUSES,
} from './sequences';

export type {
  Frame,
  FrameGenerationStatus,
  NewFrame,
  NewSequence,
  Sequence,
  SequenceStatus,
} from './sequences';

// Library Resources
export {
  audio,
  audioRelations,
  characters,
  charactersRelations,
  styleAdaptations,
  styleAdaptationsRelations,
  styles,
  stylesRelations,
  vfx,
  vfxRelations,
} from './libraries';

export type {
  Audio,
  Character,
  NewAudio,
  NewCharacter,
  NewStyle,
  NewStyleAdaptation,
  NewVfx,
  Style,
  StyleAdaptation,
  Vfx,
} from './libraries';

// API Request Tracking
export {
  falRequests,
  falRequestsRelations,
  FAL_REQUEST_STATUSES,
  letzaiRequests,
  letzaiRequestsRelations,
  LETZAI_REQUEST_STATUSES,
} from './tracking';

export type {
  FalRequest,
  FalRequestStatus,
  LetzaiRequest,
  LetzaiRequestStatus,
  NewFalRequest,
  NewLetzaiRequest,
} from './tracking';

// Credits and Transactions
export {
  credits,
  creditsRelations,
  transactions,
  transactionsRelations,
  TRANSACTION_TYPES,
} from './credits';

export type {
  Credit,
  NewCredit,
  NewTransaction,
  Transaction,
  TransactionType,
} from './credits';

// Audit
export { scriptAnalysisAudit } from './audit';

export type { ScriptAnalysisAudit, InsertScriptAnalysisAudit } from './audit';

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
  userRelations,
  sessionRelations,
  accountRelations,

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

  // Libraries
  styles,
  styleAdaptations,
  characters,
  vfx,
  audio,
  stylesRelations,
  styleAdaptationsRelations,
  charactersRelations,
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
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
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

import {
  frames,
  framesRelations,
  sequences,
  sequencesRelations,
} from './sequences';

import {
  audio,
  audioRelations,
  characters,
  charactersRelations,
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
