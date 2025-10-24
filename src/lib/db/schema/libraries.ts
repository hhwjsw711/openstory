/**
 * Library Resources Schema
 * Styles, characters, VFX, and audio assets for teams
 */

import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { sequences } from './sequences';
import { teams } from './teams';

/**
 * Styles library
 * Style Stacks - JSON configurations for consistent AI-generated content
 */
export const styles = pgTable(
  'styles',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    config: jsonb('config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    category: varchar('category', { length: 100 }),
    tags: text('tags').array().$type<string[]>().default([]),
    isPublic: boolean('is_public').default(false),
    isTemplate: boolean('is_template').default(false),
    version: integer('version').default(1),
    parentId: uuid('parent_id').references((): AnyPgColumn => styles.id, {
      onDelete: 'set null',
    }),
    previewUrl: text('preview_url'),
    usageCount: integer('usage_count').default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    teamIdIdx: index('idx_styles_team_id').on(table.teamId),
    isPublicIdx: index('idx_styles_is_public').on(table.isPublic),
    isTemplateIdx: index('idx_styles_is_template').on(table.isTemplate),
    categoryIdx: index('idx_styles_category').on(table.category),
    usageCountIdx: index('idx_styles_usage_count').on(table.usageCount),
    createdAtIdx: index('idx_styles_created_at').on(table.createdAt),
    parentIdIdx: index('idx_styles_parent_id').on(table.parentId),
  })
);

/**
 * Style adaptations
 * Model-specific configurations for different AI providers
 */
export const styleAdaptations = pgTable(
  'style_adaptations',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    styleId: uuid('style_id')
      .notNull()
      .references(() => styles.id, { onDelete: 'cascade' }),
    modelProvider: varchar('model_provider', { length: 100 }).notNull(),
    modelName: varchar('model_name', { length: 100 }).notNull(),
    adaptedConfig: jsonb('adapted_config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    styleIdIdx: index('idx_style_adaptations_style_id').on(table.styleId),
    providerModelIdx: index('idx_style_adaptations_provider_model').on(
      table.modelProvider,
      table.modelName
    ),
  })
);

/**
 * Characters library
 * LoRA models and character definitions
 */
export const characters = pgTable(
  'characters',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    loraUrl: text('lora_url'),
    config: jsonb('config').$type<Record<string, unknown>>().default({}),
    previewUrl: text('preview_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    teamIdIdx: index('idx_characters_team_id').on(table.teamId),
  })
);

/**
 * VFX library
 * Visual effects presets and configurations
 */
export const vfx = pgTable(
  'vfx',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    presetConfig: jsonb('preset_config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    previewUrl: text('preview_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    teamIdIdx: index('idx_vfx_team_id').on(table.teamId),
  })
);

/**
 * Audio library
 * Sound effects and music tracks
 */
export const audio = pgTable(
  'audio',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    fileUrl: text('file_url').notNull(),
    durationMs: integer('duration_ms'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    teamIdIdx: index('idx_audio_team_id').on(table.teamId),
  })
);

// Relations
export const stylesRelations = relations(styles, ({ one, many }) => ({
  team: one(teams, {
    fields: [styles.teamId],
    references: [teams.id],
  }),
  createdByUser: one(user, {
    fields: [styles.createdBy],
    references: [user.id],
  }),
  parent: one(styles, {
    fields: [styles.parentId],
    references: [styles.id],
    relationName: 'styleVersions',
  }),
  versions: many(styles, {
    relationName: 'styleVersions',
  }),
  adaptations: many(styleAdaptations),
  sequences: many(sequences), // Add reverse relation from sequences
}));

export const styleAdaptationsRelations = relations(
  styleAdaptations,
  ({ one }) => ({
    style: one(styles, {
      fields: [styleAdaptations.styleId],
      references: [styles.id],
    }),
  })
);

export const charactersRelations = relations(characters, ({ one }) => ({
  team: one(teams, {
    fields: [characters.teamId],
    references: [teams.id],
  }),
  createdByUser: one(user, {
    fields: [characters.createdBy],
    references: [user.id],
  }),
}));

export const vfxRelations = relations(vfx, ({ one }) => ({
  team: one(teams, {
    fields: [vfx.teamId],
    references: [teams.id],
  }),
  createdByUser: one(user, {
    fields: [vfx.createdBy],
    references: [user.id],
  }),
}));

export const audioRelations = relations(audio, ({ one }) => ({
  team: one(teams, {
    fields: [audio.teamId],
    references: [teams.id],
  }),
  createdByUser: one(user, {
    fields: [audio.createdBy],
    references: [user.id],
  }),
}));

// Type exports
export type Style = InferSelectModel<typeof styles>;
export type NewStyle = InferInsertModel<typeof styles>;

export type StyleAdaptation = InferSelectModel<typeof styleAdaptations>;
export type NewStyleAdaptation = InferInsertModel<typeof styleAdaptations>;

export type Character = InferSelectModel<typeof characters>;
export type NewCharacter = InferInsertModel<typeof characters>;

export type Vfx = InferSelectModel<typeof vfx>;
export type NewVfx = InferInsertModel<typeof vfx>;

export type Audio = InferSelectModel<typeof audio>;
export type NewAudio = InferInsertModel<typeof audio>;
