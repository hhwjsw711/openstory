/**
 * Database Types - Now using Drizzle ORM
 *
 * This file provides type exports for the database schema using Drizzle ORM.
 * All types use camelCase field names thanks to Drizzle's casing configuration.
 */

import type { Database } from '@/lib/db/client';
import type {
  User,
  Team,
  NewTeam,
  TeamMember,
  NewTeamMember,
  TeamInvitation,
  NewTeamInvitation,
  Sequence,
  NewSequence,
  Frame,
  NewFrame,
  Style,
  NewStyle,
  StyleAdaptation,
  Character,
  NewCharacter,
  Audio,
  NewAudio,
  Vfx,
  NewVfx,
  Credit,
  NewCredit,
  Transaction,
  NewTransaction,
  FalRequest,
  NewFalRequest,
  LetzaiRequest,
  NewLetzaiRequest,
  BetterAuthUser,
  BetterAuthSession,
  BetterAuthAccount,
  BetterAuthVerification,
  SequenceStatus,
  TeamMemberRole,
  InvitationStatus,
  TransactionType,
  FalRequestStatus,
  LetzaiRequestStatus,
} from '@/lib/db/schema';

// Re-export Database type
export type { Database };

// JSON type for metadata fields (compatible with Supabase Json type)
export type Json = Record<string, unknown> | unknown[];

// Table row types (SELECT results - use camelCase field names)
export type {
  User,
  Team,
  TeamMember,
  TeamInvitation,
  Sequence,
  Frame,
  Style,
  Character,
  Audio,
};
export type VFX = Vfx; // Alias for consistency
export type { Credit, Transaction, FalRequest, StyleAdaptation };
export type LetzAIRequest = LetzaiRequest; // Alias for consistency

// BetterAuth table types
export type {
  BetterAuthUser,
  BetterAuthSession,
  BetterAuthAccount,
  BetterAuthVerification,
};

// User profile alias (for backward compatibility)
export type UserProfile = User;
export type UserProfileRow = User;

// Insert types (for creating new records)
export type TeamInsert = NewTeam;
export type TeamMemberInsert = NewTeamMember;
export type TeamInvitationInsert = NewTeamInvitation;
export type SequenceInsert = NewSequence;
export type FrameInsert = NewFrame;
export type StyleInsert = NewStyle;
export type CharacterInsert = NewCharacter;
export type AudioInsert = NewAudio;
export type VFXInsert = NewVfx;
export type CreditInsert = NewCredit;
export type TransactionInsert = NewTransaction;
export type FalRequestInsert = NewFalRequest;
export type LetzAIRequestInsert = NewLetzaiRequest;

// Update types (partial of row types - Drizzle handles this automatically)
export type TeamUpdate = Partial<Team>;
export type TeamMemberUpdate = Partial<TeamMember>;
export type TeamInvitationUpdate = Partial<TeamInvitation>;
export type SequenceUpdate = Partial<Sequence>;
export type FrameUpdate = Partial<Frame>;
export type StyleUpdate = Partial<Style>;
export type CharacterUpdate = Partial<Character>;
export type AudioUpdate = Partial<Audio>;
export type VFXUpdate = Partial<Vfx>;
export type CreditUpdate = Partial<Credit>;
export type TransactionUpdate = Partial<Transaction>;
export type FalRequestUpdate = Partial<FalRequest>;
export type LetzAIRequestUpdate = Partial<LetzaiRequest>;

// Enum types (re-export from schema)
export type {
  SequenceStatus,
  TeamMemberRole,
  InvitationStatus,
  TransactionType,
  FalRequestStatus,
  LetzaiRequestStatus,
};
