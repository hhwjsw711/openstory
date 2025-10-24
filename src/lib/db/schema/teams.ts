/**
 * Teams Schema
 * Team management, members, and invitations
 */

import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

// Enums
export const teamMemberRoleEnum = [
  'owner',
  'admin',
  'member',
  'viewer',
] as const;
export type TeamMemberRole = (typeof teamMemberRoleEnum)[number];

export const invitationStatusEnum = [
  'pending',
  'accepted',
  'declined',
  'expired',
] as const;
export type InvitationStatus = (typeof invitationStatusEnum)[number];

/**
 * Teams table
 * Core organization entity for collaboration
 */
export const teams = pgTable(
  'teams',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    slugIdx: index('idx_teams_slug').on(table.slug),
    slugUnique: unique('teams_slug_unique').on(table.slug),
  })
);

/**
 * Team members junction table
 * Links users to teams with roles
 */
export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: teamMemberRoleEnum })
      .notNull()
      .default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
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
export const teamInvitations = pgTable(
  'team_invitations',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: text('role', { enum: teamMemberRoleEnum })
      .notNull()
      .default('member'),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status', { enum: invitationStatusEnum })
      .notNull()
      .default('pending'),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    declinedAt: timestamp('declined_at', { withTimezone: true }),
  },
  (table) => ({
    teamIdIdx: index('idx_team_invitations_team_id').on(table.teamId),
    emailIdx: index('idx_team_invitations_email').on(table.email),
    tokenIdx: index('idx_team_invitations_token').on(table.token),
    statusIdx: index('idx_team_invitations_status').on(table.status),
    expiresAtIdx: index('idx_team_invitations_expires_at').on(table.expiresAt),
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
    invitedByUser: one(user, {
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
