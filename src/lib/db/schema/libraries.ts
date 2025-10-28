/**
 * Library Resources Schema
 * Styles, characters, VFX, and audio assets for teams
 */

import {
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { teams } from './teams';

/**
 * Styles library
 * Style Stacks - JSON configurations for consistent AI-generated content
 */
export const styles = pgTable(
  'styles',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    teamId: uuid('team_id').notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    config: jsonb().default({}).notNull(),
    category: varchar({ length: 100 }),
    tags: text().array().default(['']),
    isPublic: boolean('is_public').default(false),
    isTemplate: boolean('is_template').default(false),
    version: integer().default(1),
    parentId: uuid('parent_id'),
    previewUrl: text('preview_url'),
    usageCount: integer('usage_count').default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by'),
  },
  (table) => [
    index('idx_styles_category').using(
      'btree',
      table.category.asc().nullsLast().op('text_ops')
    ),
    index('idx_styles_created_at').using(
      'btree',
      table.createdAt.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_styles_is_public').using(
      'btree',
      table.isPublic.asc().nullsLast().op('bool_ops')
    ),
    index('idx_styles_is_template').using(
      'btree',
      table.isTemplate.asc().nullsLast().op('bool_ops')
    ),
    index('idx_styles_name_gin').using(
      'gin',
      table.name.asc().nullsLast().op('gin_trgm_ops')
    ),
    index('idx_styles_parent_id').using(
      'btree',
      table.parentId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_styles_tags_gin').using(
      'gin',
      table.tags.asc().nullsLast().op('array_ops')
    ),
    index('idx_styles_team_id').using(
      'btree',
      table.teamId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_styles_usage_count').using(
      'btree',
      table.usageCount.desc().nullsFirst().op('int4_ops')
    ),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: 'styles_team_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'styles_parent_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [user.id],
      name: 'styles_created_by_fkey',
    }).onDelete('set null'),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

/**
 * Style adaptations
 * Model-specific configurations for different AI providers
 */
export const styleAdaptations = pgTable(
  'style_adaptations',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    styleId: uuid('style_id').notNull(),
    modelProvider: varchar('model_provider', { length: 100 }).notNull(),
    modelName: varchar('model_name', { length: 100 }).notNull(),
    adaptedConfig: jsonb('adapted_config').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_style_adaptations_provider_model').using(
      'btree',
      table.modelProvider.asc().nullsLast().op('text_ops'),
      table.modelName.asc().nullsLast().op('text_ops')
    ),
    index('idx_style_adaptations_style_id').using(
      'btree',
      table.styleId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.styleId],
      foreignColumns: [styles.id],
      name: 'style_adaptations_style_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

/**
 * Characters library
 * LoRA models and character definitions
 */
export const characters = pgTable(
  'characters',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    teamId: uuid('team_id').notNull(),
    name: varchar({ length: 255 }).notNull(),
    loraUrl: text('lora_url'),
    config: jsonb().default({}),
    previewUrl: text('preview_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by'),
  },
  (table) => [
    index('idx_characters_name').using(
      'btree',
      table.name.asc().nullsLast().op('text_ops')
    ),
    index('idx_characters_team_id').using(
      'btree',
      table.teamId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: 'characters_team_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [user.id],
      name: 'characters_created_by_fkey',
    }).onDelete('set null'),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

/**
 * VFX library
 * Visual effects presets and configurations
 */
export const vfx = pgTable(
  'vfx',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    teamId: uuid('team_id').notNull(),
    name: varchar({ length: 255 }).notNull(),
    presetConfig: jsonb('preset_config').default({}).notNull(),
    previewUrl: text('preview_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by'),
  },
  (table) => [
    index('idx_vfx_name').using(
      'btree',
      table.name.asc().nullsLast().op('text_ops')
    ),
    index('idx_vfx_team_id').using(
      'btree',
      table.teamId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: 'vfx_team_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [user.id],
      name: 'vfx_created_by_fkey',
    }).onDelete('set null'),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

/**
 * Audio library
 * Sound effects and music tracks
 */
export const audio = pgTable(
  'audio',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    teamId: uuid('team_id').notNull(),
    name: varchar({ length: 255 }).notNull(),
    fileUrl: text('file_url').notNull(),
    durationMs: integer('duration_ms'),
    metadata: jsonb().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by'),
  },
  (table) => [
    index('idx_audio_name').using(
      'btree',
      table.name.asc().nullsLast().op('text_ops')
    ),
    index('idx_audio_team_id').using(
      'btree',
      table.teamId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: 'audio_team_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [user.id],
      name: 'audio_created_by_fkey',
    }).onDelete('set null'),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

// Relations
export const stylesRelations = relations(styles, ({ one, many }) => ({
  team: one(teams, {
    fields: [styles.teamId],
    references: [teams.id],
  }),
  style: one(styles, {
    fields: [styles.parentId],
    references: [styles.id],
    relationName: 'styles_parentId_styles_id',
  }),
  styles: many(styles, {
    relationName: 'styles_parentId_styles_id',
  }),
  user: one(user, {
    fields: [styles.createdBy],
    references: [user.id],
  }),
  styleAdaptations: many(styleAdaptations),
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
  user: one(user, {
    fields: [characters.createdBy],
    references: [user.id],
  }),
}));

export const vfxRelations = relations(vfx, ({ one }) => ({
  team: one(teams, {
    fields: [vfx.teamId],
    references: [teams.id],
  }),
  user: one(user, {
    fields: [vfx.createdBy],
    references: [user.id],
  }),
}));

export const audioRelations = relations(audio, ({ one }) => ({
  team: one(teams, {
    fields: [audio.teamId],
    references: [teams.id],
  }),
  user: one(user, {
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
