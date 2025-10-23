/**
 * Drizzle ORM Schema Index
 * Central export point for all database schemas and relations
 */

// Better Auth tables
export {
  betterAuthUser,
  betterAuthSession,
  betterAuthAccount,
  betterAuthVerification,
  betterAuthUserRelations,
  betterAuthSessionRelations,
  betterAuthAccountRelations,
} from './auth';

export type {
  BetterAuthUser,
  NewBetterAuthUser,
  BetterAuthSession,
  NewBetterAuthSession,
  BetterAuthAccount,
  NewBetterAuthAccount,
  BetterAuthVerification,
  NewBetterAuthVerification,
} from './auth';

// Users
export { users } from './users';
export type { User, NewUser } from './users';

// Teams
export {
  teams,
  teamMembers,
  teamInvitations,
  teamsRelations,
  teamMembersRelations,
  teamInvitationsRelations,
  teamMemberRoleEnum,
  invitationStatusEnum,
} from './teams';

export type {
  Team,
  NewTeam,
  TeamMember,
  NewTeamMember,
  TeamInvitation,
  NewTeamInvitation,
  TeamMemberRole,
  InvitationStatus,
} from './teams';

// Sequences
export {
  sequences,
  frames,
  sequencesRelations,
  framesRelations,
  sequenceStatusEnum,
} from './sequences';

export type {
  Sequence,
  NewSequence,
  Frame,
  NewFrame,
  SequenceStatus,
} from './sequences';

// Library Resources
export {
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
} from './libraries';

export type {
  Style,
  NewStyle,
  StyleAdaptation,
  NewStyleAdaptation,
  Character,
  NewCharacter,
  Vfx,
  NewVfx,
  Audio,
  NewAudio,
} from './libraries';

// API Request Tracking
export {
  falRequests,
  letzaiRequests,
  falRequestsRelations,
  letzaiRequestsRelations,
  falRequestStatusEnum,
  letzaiRequestStatusEnum,
} from './tracking';

export type {
  FalRequest,
  NewFalRequest,
  LetzaiRequest,
  NewLetzaiRequest,
  FalRequestStatus,
  LetzaiRequestStatus,
} from './tracking';

// Credits and Transactions
export {
  credits,
  transactions,
  creditsRelations,
  transactionsRelations,
  transactionTypeEnum,
} from './credits';

export type {
  Credit,
  NewCredit,
  Transaction,
  NewTransaction,
  TransactionType,
} from './credits';

/**
 * Complete schema object for Drizzle client initialization
 * Import this when creating your Drizzle instance
 */
export const schema = {
  // Better Auth
  betterAuthUser,
  betterAuthSession,
  betterAuthAccount,
  betterAuthVerification,
  betterAuthUserRelations,
  betterAuthSessionRelations,
  betterAuthAccountRelations,

  // Users
  users,

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
};

// Re-export necessary Drizzle imports for convenience
export { pgTable, pgEnum } from 'drizzle-orm/pg-core';
export { eq, and, or, sql, desc, asc } from 'drizzle-orm';

// Import statements (not exported, just for local use)
import {
  betterAuthUser,
  betterAuthSession,
  betterAuthAccount,
  betterAuthVerification,
  betterAuthUserRelations,
  betterAuthSessionRelations,
  betterAuthAccountRelations,
} from './auth';

import { users } from './users';

import {
  teams,
  teamMembers,
  teamInvitations,
  teamsRelations,
  teamMembersRelations,
  teamInvitationsRelations,
} from './teams';

import {
  sequences,
  frames,
  sequencesRelations,
  framesRelations,
} from './sequences';

import {
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
} from './libraries';

import {
  falRequests,
  letzaiRequests,
  falRequestsRelations,
  letzaiRequestsRelations,
} from './tracking';

import {
  credits,
  transactions,
  creditsRelations,
  transactionsRelations,
} from './credits';
