/**
 * Teams Schema
 * Team management, members, and invitations
 */

import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { user } from './auth';

// Enum values as constants (SQLite doesn't have native enums)
export const TEAM_MEMBER_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number];

export const INVITATION_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'expired',
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/**
 * Teams table
 * Core organization entity for collaboration
 */
export const teams = sqliteTable(
  'teams',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    name: text({ length: 255 }).notNull(),
    slug: text({ length: 255 }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    slugIdx: index('idx_teams_slug').on(table.slug).unique(),
  })
);

/**
 * Team members junction table
 * Links users to teams with roles
 */
export const teamMembers = sqliteTable(
  'team_members',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text().$type<TeamMemberRole>().default('member').notNull(),
    joinedAt: integer('joined_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teamId, table.userId] }),
    teamIdIdx: index('idx_team_members_team_id').on(table.teamId),
    userIdIdx: index('idx_team_members_user_id').on(table.userId),
  })
);

/**
 * Team invitations table
 * Manages pending, accepted, and declined team invitations
 */
export const teamInvitations = sqliteTable(
  'team_invitations',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    email: text({ length: 255 }).notNull(),
    role: text().$type<TeamMemberRole>().default('member').notNull(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text().$type<InvitationStatus>().default('pending').notNull(),
    token: text({ length: 255 }).notNull(),
    // Default expiration: 7 days from now (handle in application code)
    expiresAt: integer('expires_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
      .notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    acceptedAt: integer('accepted_at', { mode: 'timestamp' }),
    declinedAt: integer('declined_at', { mode: 'timestamp' }),
  },
  (table) => ({
    emailIdx: index('idx_team_invitations_email').on(table.email),
    expiresAtIdx: index('idx_team_invitations_expires_at').on(table.expiresAt),
    statusIdx: index('idx_team_invitations_status').on(table.status),
    teamIdIdx: index('idx_team_invitations_team_id').on(table.teamId),
    tokenIdx: index('idx_team_invitations_token').on(table.token).unique(),
    // Note: Partial unique index not supported in SQLite the same way
    // Enforce unique pending invitations in application logic or trigger
    uniquePendingIdx: index('idx_team_invitations_unique_pending').on(
      table.teamId,
      table.email
    ),
  })
);

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  invitations: many(teamInvitations),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(user, {
    fields: [teamMembers.userId],
    references: [user.id],
  }),
}));

export const teamInvitationsRelations = relations(
  teamInvitations,
  ({ one }) => ({
    team: one(teams, {
      fields: [teamInvitations.teamId],
      references: [teams.id],
    }),
    user: one(user, {
      fields: [teamInvitations.invitedBy],
      references: [user.id],
    }),
  })
);

// Type exports
export type Team = InferSelectModel<typeof teams>;
export type NewTeam = InferInsertModel<typeof teams>;

export type TeamMember = InferSelectModel<typeof teamMembers>;
export type NewTeamMember = InferInsertModel<typeof teamMembers>;

export type TeamInvitation = InferSelectModel<typeof teamInvitations>;
export type NewTeamInvitation = InferInsertModel<typeof teamInvitations>;
