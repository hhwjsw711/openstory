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

import { characterSheets, characterSheetsRelations } from './character-sheets';

import { frameCharacters, frameCharactersRelations } from './frame-characters';

// Location Library (team-level templates)
import { locationLibrary, locationLibraryRelations } from './location-library';

// Sequence Locations (script-extracted)
import {
  sequenceLocations,
  sequenceLocationsRelations,
} from './sequence-locations';

import { locationSheets, locationSheetsRelations } from './location-sheets';

import { frameLocations, frameLocationsRelations } from './frame-locations';

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

// Character Sheets (role-specific looks/costumes)
export { characterSheets };

export type {
  CharacterSheet,
  CharacterSheetSource,
  NewCharacterSheet,
} from './character-sheets';

// Frame Characters (which characters appear in which frames)
export { frameCharacters };

export type {
  FrameCharacter,
  FrameCharacterWithDetails,
  NewFrameCharacter,
} from './frame-characters';

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

// Frame Locations (which location in each frame)
export { frameLocations };

export type {
  FrameLocation,
  FrameLocationWithDetails,
  NewFrameLocation,
} from './frame-locations';

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

  // Characters (scripted roles extracted from script)
  characters,
  charactersRelations,

  // Character Sheets (role-specific looks/costumes)
  characterSheets,
  characterSheetsRelations,

  // Frame Characters (which characters in each frame)
  frameCharacters,
  frameCharactersRelations,

  // Location Library (team-level templates)
  locationLibrary,
  locationLibraryRelations,

  // Sequence Locations (extracted from script)
  sequenceLocations,
  sequenceLocationsRelations,

  // Location Sheets (location-specific variations for library locations)
  locationSheets,
  locationSheetsRelations,

  // Frame Locations (which location in each frame)
  frameLocations,
  frameLocationsRelations,

  // Talent Library
  talent,
  talentRelations,
  talentSheets,
  talentSheetsRelations,
  talentMedia,
  talentMediaRelations,

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
