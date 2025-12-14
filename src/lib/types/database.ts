/**
 * Database Types - Now using Drizzle ORM
 *
 * This file provides type exports for the database schema using Drizzle ORM.
 * All types use camelCase field names thanks to Drizzle's casing configuration.
 */

import type { Database } from '@/lib/db/client';
import type {
  Account,
  Audio,
  Character,
  Credit,
  FalRequest,
  FalRequestStatus,
  Frame,
  InvitationStatus,
  LetzaiRequest,
  LetzaiRequestStatus,
  NewAudio,
  NewCharacter,
  NewCredit,
  NewFalRequest,
  NewFrame,
  NewLetzaiRequest,
  NewSequence,
  NewStyle,
  NewTeam,
  NewTeamInvitation,
  NewTeamMember,
  NewTransaction,
  NewVfx,
  Sequence,
  SequenceStatus,
  Session,
  Style,
  StyleAdaptation,
  Team,
  TeamInvitation,
  TeamMember,
  TeamMemberRole,
  Transaction,
  TransactionType,
  User,
  Verification,
  Vfx,
} from '@/lib/db/schema';

// Re-export Database type
// JSON type for metadata fields (compatible with Supabase Json type)
export type Json = Record<string, unknown> | unknown[];

// Table row types (SELECT results - use camelCase field names)
export type { Frame, Sequence, Style, Team };
type VFX = Vfx; // Alias for consistency
type LetzAIRequest = LetzaiRequest; // Alias for consistency

// BetterAuth table types
// User profile alias (for backward compatibility)
export type UserProfile = User;
type UserProfileRow = User;

// Insert types (for creating new records)
type TeamInsert = NewTeam;
type TeamMemberInsert = NewTeamMember;
type TeamInvitationInsert = NewTeamInvitation;
type SequenceInsert = NewSequence;
type FrameInsert = NewFrame;
type StyleInsert = NewStyle;
type CharacterInsert = NewCharacter;
type AudioInsert = NewAudio;
type VFXInsert = NewVfx;
type CreditInsert = NewCredit;
type TransactionInsert = NewTransaction;
type FalRequestInsert = NewFalRequest;
type LetzAIRequestInsert = NewLetzaiRequest;

// Update types (partial of row types - Drizzle handles this automatically)
type TeamUpdate = Partial<Team>;
type TeamMemberUpdate = Partial<TeamMember>;
type TeamInvitationUpdate = Partial<TeamInvitation>;
type SequenceUpdate = Partial<Sequence>;
type FrameUpdate = Partial<Frame>;
type StyleUpdate = Partial<Style>;
type CharacterUpdate = Partial<Character>;
type AudioUpdate = Partial<Audio>;
type VFXUpdate = Partial<Vfx>;
type CreditUpdate = Partial<Credit>;
type TransactionUpdate = Partial<Transaction>;
type FalRequestUpdate = Partial<FalRequest>;
type LetzAIRequestUpdate = Partial<LetzaiRequest>;

// Enum types (re-export from schema)
