/**
 * Library Resources Schema
 * Styles, characters, VFX, and audio assets for teams
 */

import {
  type InferInsertModel,
  type InferSelectModel,
  relations,
} from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import z from 'zod';
import { generateId } from '../id';
import { user } from './auth';
import { teams } from './teams';

export const StyleConfigSchema = z.object({
  mood: z.string().min(3).max(500),
  artStyle: z.string().min(3).max(500),
  lighting: z.string().min(3).max(500),
  colorPalette: z.array(z.string().min(1)).min(1).max(20),
  cameraWork: z.string().min(3).max(500),
  referenceFilms: z.array(z.string().min(1)).max(50),
  colorGrading: z.string().min(3).max(300),
});

export type StyleConfig = z.infer<typeof StyleConfigSchema>;

/**
 * Styles library
 * Style Stacks - JSON configurations for consistent AI-generated content
 */
export const styles = sqliteTable(
  'styles',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text({ length: 255 }).notNull(),
    description: text(),
    config: text({ mode: 'json' }).$type<StyleConfig>().notNull(),
    category: text({ length: 100 }),
    // SQLite doesn't have array type - store as JSON array
    tags: text({ mode: 'json' })
      .$type<string[]>()
      .$defaultFn(() => []),
    isPublic: integer('is_public', { mode: 'boolean' }).default(false),
    isTemplate: integer('is_template', { mode: 'boolean' }).default(false),
    version: integer().default(1),
    previewUrl: text('preview_url'),
    sortOrder: integer('sort_order').default(100),
    usageCount: integer('usage_count').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [index('idx_styles_team_id').on(table.teamId)]
);

/**
 * Style adaptations
 * Model-specific configurations for different AI providers
 */
export const styleAdaptations = sqliteTable(
  'style_adaptations',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    styleId: text('style_id')
      .notNull()
      .references(() => styles.id, { onDelete: 'cascade' }),
    modelProvider: text('model_provider', { length: 100 }).notNull(),
    modelName: text('model_name', { length: 100 }).notNull(),
    adaptedConfig: text('adapted_config', { mode: 'json' })
      .default('{}')
      .notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_style_adaptations_provider_model').on(
      table.modelProvider,
      table.modelName
    ),
    index('idx_style_adaptations_style_id').on(table.styleId),
  ]
);

/**
 * VFX library
 * Visual effects presets and configurations
 */
export const vfx = sqliteTable(
  'vfx',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text({ length: 255 }).notNull(),
    presetConfig: text('preset_config', { mode: 'json' })
      .default('{}')
      .notNull(),
    previewUrl: text('preview_url'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('idx_vfx_name').on(table.name),
    index('idx_vfx_team_id').on(table.teamId),
  ]
);

/**
 * Audio library
 * Sound effects and music tracks
 */
export const audio = sqliteTable(
  'audio',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text({ length: 255 }).notNull(),
    fileUrl: text('file_url').notNull(),
    durationMs: integer('duration_ms'),
    metadata: text({ mode: 'json' }).default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('idx_audio_name').on(table.name),
    index('idx_audio_team_id').on(table.teamId),
  ]
);

// Relations
export const stylesRelations = relations(styles, ({ one, many }) => ({
  team: one(teams, {
    fields: [styles.teamId],
    references: [teams.id],
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

export type Vfx = InferSelectModel<typeof vfx>;
export type NewVfx = InferInsertModel<typeof vfx>;

export type Audio = InferSelectModel<typeof audio>;
export type NewAudio = InferInsertModel<typeof audio>;
