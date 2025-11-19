/**
 * Drizzle ORM Schema Index
 * Central export point for all database schemas and relations
 */

// Better Auth tables
export { account, session, user, verification } from './auth';

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
  TEAM_MEMBER_ROLES,
  teamInvitations,
  teamInvitationsRelations,
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
  SEQUENCE_STATUSES,
  sequences,
  sequencesRelations,
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
  FAL_REQUEST_STATUSES,
  falRequests,
  falRequestsRelations,
  LETZAI_REQUEST_STATUSES,
  letzaiRequests,
  letzaiRequestsRelations,
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
  TRANSACTION_TYPES,
  transactions,
  transactionsRelations,
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

export type { InsertScriptAnalysisAudit, ScriptAnalysisAudit } from './audit';

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
import { account, session, user, verification } from './auth';

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
