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

import { characters, charactersRelations } from './characters';

// Location Library (team-level templates)
import { locationLibrary, locationLibraryRelations } from './location-library';

// Sequence Locations (script-extracted)
import {
  sequenceLocations,
  sequenceLocationsRelations,
} from './sequence-locations';

import { locationSheets, locationSheetsRelations } from './location-sheets';

import {
  talent,
  talentMedia,
  talentMediaRelations,
  talentSheets,
  talentSheetsRelations,
  talentRelations,
} from './talent';

import {
  audio,
  audioRelations,
  StyleConfigSchema,
  styles,
  stylesRelations,
  vfx,
  vfxRelations,
} from './libraries';

import {
  creditBatches,
  creditBatchesRelations,
  credits,
  creditsRelations,
  teamBillingSettings,
  teamBillingSettingsRelations,
  transactions,
  transactionsRelations,
} from './credits';

import { teamApiKeys, teamApiKeysRelations } from './team-api-keys';

// DAG Dependency System
import { entityVersions } from './entity-versions';
import { dependencies } from './dependencies';
import { generationRecords } from './generation-records';
import {
  workflowSnapshots,
  workflows as dagWorkflows,
} from './workflow-snapshots';

import {
  giftTokenRedemptions,
  giftTokenRedemptionsRelations,
  giftTokens,
  giftTokensRelations,
} from './gift-tokens';

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
  characters: many(characters),
  locations: many(sequenceLocations),
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

// Characters (scripted roles)
export { characters };

export type {
  Character,
  CharacterMinimal,
  CharacterWithTalent,
  NewCharacter,
  SheetStatus,
} from './characters';

// Location Library (team-level templates)
export { locationLibrary };

export type {
  LibraryLocation,
  LibraryLocationMinimal,
  NewLibraryLocation,
} from './location-library';

// Sequence Locations (extracted from script)
export { sequenceLocations };

export type {
  NewSequenceLocation,
  ReferenceStatus,
  SequenceLocation,
  SequenceLocationMinimal,
  SequenceLocationWithDetails,
} from './sequence-locations';

// Location Sheets (location-specific variations for library locations)
export { locationSheets };

export type {
  LocationSheet,
  LocationSheetSource,
  NewLocationSheet,
} from './location-sheets';

// Talent Library
export { talent, talentMedia, talentSheets };

export type {
  NewTalent,
  NewTalentMedia,
  NewTalentSheet,
  Talent,
  TalentMediaRecord,
  TalentMediaType,
  TalentSheet,
  TalentSheetSource,
  TalentWithRelations,
  TalentWithSheets,
} from './talent';

// Library Resources
export { audio, StyleConfigSchema, styles, vfx };

export type {
  Audio,
  NewAudio,
  NewStyle,
  NewVfx,
  Style,
  StyleConfig,
  Vfx,
} from './libraries';

// Credits, Transactions, and Billing
export { creditBatches, credits, transactions, teamBillingSettings };

export type {
  Credit,
  CreditBatch,
  CreditBatchSource,
  NewCredit,
  NewCreditBatch,
  NewTeamBillingSetting,
  NewTransaction,
  TeamBillingSetting,
  Transaction,
  TransactionType,
} from './credits';

// Team API Keys
export { teamApiKeys };

export type {
  ApiKeyProvider,
  ApiKeySource,
  NewTeamApiKey,
  TeamApiKey,
} from './team-api-keys';

// DAG Dependency System
export {
  dependencies,
  dagWorkflows,
  entityVersions,
  generationRecords,
  workflowSnapshots,
};

export type {
  EntityType,
  EntityVersion,
  LifecycleState,
  NewEntityVersion,
} from './entity-versions';

export type { Dependency, DependencyType, NewDependency } from './dependencies';

export type {
  GenerationRecord,
  NewGenerationRecord,
} from './generation-records';

export type {
  DagWorkflow,
  NewDagWorkflow,
  NewWorkflowSnapshot,
  WorkflowSnapshot,
  WorkflowStatus,
} from './workflow-snapshots';

// Gift Tokens
export { giftTokens, giftTokenRedemptions };

export type {
  GiftToken,
  GiftTokenRedemption,
  NewGiftToken,
  NewGiftTokenRedemption,
} from './gift-tokens';

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

  // Characters (scripted roles extracted from script)
  characters,
  charactersRelations,

  // Location Library (team-level templates)
  locationLibrary,
  locationLibraryRelations,

  // Sequence Locations (extracted from script)
  sequenceLocations,
  sequenceLocationsRelations,

  // Location Sheets (location-specific variations for library locations)
  locationSheets,
  locationSheetsRelations,

  // Talent Library
  talent,
  talentRelations,
  talentSheets,
  talentSheetsRelations,
  talentMedia,
  talentMediaRelations,

  // Libraries
  styles,
  vfx,
  audio,
  stylesRelations,
  vfxRelations,
  audioRelations,

  // Credits & Billing
  credits,
  creditBatches,
  transactions,
  teamBillingSettings,
  creditsRelations,
  creditBatchesRelations,
  transactionsRelations,
  teamBillingSettingsRelations,

  // Team API Keys
  teamApiKeys,
  teamApiKeysRelations,

  // DAG Dependency System
  entityVersions,
  dependencies,
  generationRecords,
  workflowSnapshots,
  dagWorkflows,

  // Gift Tokens
  giftTokens,
  giftTokensRelations,
  giftTokenRedemptions,
  giftTokenRedemptionsRelations,
};
