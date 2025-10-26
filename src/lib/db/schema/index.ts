/**
 * Drizzle ORM Schema Index
 * Central export point for all database schemas and relations
 */

// Better Auth tables
export {
  account,
  accountRelations,
  anonymousSessions,
  session,
  sessionRelations,
  user,
  userProfiles,
  userRelations,
  users,
  verification,
} from './auth';

export type {
  Account,
  AnonymousSession,
  NewAccount,
  NewAnonymousSession,
  NewSession,
  NewUser,
  NewUserProfile,
  NewUsers,
  NewVerification,
  Session,
  User,
  UserProfile,
  Users,
  Verification,
} from './auth';

// Teams
export {
  invitationStatus,
  teamInvitations,
  teamInvitationsRelations,
  teamMemberRole,
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
  frames,
  framesRelations,
  sequenceStatus,
  sequences,
  sequencesRelations,
} from './sequences';

export type {
  Frame,
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
  falRequestStatus,
  falRequests,
  falRequestsRelations,
  letzaiRequests,
  letzaiRequestsRelations,
  letzaiRequestStatus,
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
  transactionType,
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

  // Velro User tables
  users,
  userProfiles,
  anonymousSessions,

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

// Import statements (not exported, just for local use)
import {
  account,
  accountRelations,
  anonymousSessions,
  session,
  sessionRelations,
  user,
  userProfiles,
  userRelations,
  users,
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
