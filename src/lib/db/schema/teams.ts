/**
 * Teams Schema
 * Team management, members, and invitations
 */

import {
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from 'drizzle-orm';
import {
  foreignKey,
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

// Enums
export const teamMemberRole = pgEnum('team_member_role', [
  'owner',
  'admin',
  'member',
  'viewer',
]);

export const invitationStatus = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'declined',
  'expired',
]);

/**
 * Teams table
 * Core organization entity for collaboration
 */
export const teams = pgTable(
  'teams',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_teams_slug').using(
      'btree',
      table.slug.asc().nullsLast().op('text_ops')
    ),
    unique('teams_slug_key').on(table.slug),
    unique('teams_slug_unique').on(table.slug),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

/**
 * Team members junction table
 * Links users to teams with roles
 */
export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: teamMemberRole().default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_team_members_team_id').using(
      'btree',
      table.teamId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_team_members_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: 'team_members_team_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'team_members_user_id_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.teamId, table.userId],
      name: 'team_members_pkey',
    }),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

/**
 * Team invitations table
 * Manages pending, accepted, and declined team invitations
 */
export const teamInvitations = pgTable(
  'team_invitations',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    teamId: uuid('team_id').notNull(),
    email: varchar({ length: 255 }).notNull(),
    role: teamMemberRole().default('member').notNull(),
    invitedBy: uuid('invited_by').notNull(),
    status: invitationStatus().default('pending').notNull(),
    token: varchar({ length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' })
      .default(sql`(now() + '7 days'::interval)`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    acceptedAt: timestamp('accepted_at', {
      withTimezone: true,
      mode: 'date',
    }),
    declinedAt: timestamp('declined_at', {
      withTimezone: true,
      mode: 'date',
    }),
  },
  (table) => [
    index('idx_team_invitations_email').using(
      'btree',
      table.email.asc().nullsLast().op('text_ops')
    ),
    index('idx_team_invitations_expires_at').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops')
    ),
    index('idx_team_invitations_status').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops')
    ),
    index('idx_team_invitations_team_id').using(
      'btree',
      table.teamId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_team_invitations_token').using(
      'btree',
      table.token.asc().nullsLast().op('text_ops')
    ),
    uniqueIndex('idx_team_invitations_unique_pending')
      .using(
        'btree',
        table.teamId.asc().nullsLast().op('uuid_ops'),
        table.email.asc().nullsLast().op('uuid_ops')
      )
      .where(sql`(status = 'pending'::invitation_status)`),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: 'team_invitations_team_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.invitedBy],
      foreignColumns: [users.id],
      name: 'team_invitations_invited_by_fkey',
    }).onDelete('cascade'),
    unique('team_invitations_token_key').on(table.token),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
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
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const teamInvitationsRelations = relations(
  teamInvitations,
  ({ one }) => ({
    team: one(teams, {
      fields: [teamInvitations.teamId],
      references: [teams.id],
    }),
    user: one(users, {
      fields: [teamInvitations.invitedBy],
      references: [users.id],
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

// Enum type exports
export type TeamMemberRole = (typeof teamMemberRole.enumValues)[number];
export type InvitationStatus = (typeof invitationStatus.enumValues)[number];
