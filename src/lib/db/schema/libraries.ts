/**
 * Library Resources Schema
 * Styles, characters, VFX, and audio assets for teams
 */

import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  index,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { user } from './auth';
import { teams } from './teams';

type ColorString = string;

type StyleConfig = {
  artStyle: string; // 'Neo-noir with stark contrasts and neon accents',
  colorPalette: ColorString[];
  lighting: string; // 'High contrast with venetian blind shadows and neon highlights',
  cameraWork: string; // 'Dutch angles and voyeuristic framing',
  mood: string; // 'Tense and mysterious';
  referenceFilms: string[]; // ['Blade Runner', 'Sin City', 'Drive'],
  colorGrading: string; // 'Desaturated with selective color pops',
};

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
    tags: text({ mode: 'json' }).$type<string[]>().default('[]'),
    isPublic: integer('is_public', { mode: 'boolean' }).default(false),
    isTemplate: integer('is_template', { mode: 'boolean' }).default(false),
    version: integer().default(1),
    parentId: text('parent_id').references(() => styles.id, {
      onDelete: 'set null',
    }),
    previewUrl: text('preview_url'),
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
  (table) => ({
    categoryIdx: index('idx_styles_category').on(table.category),
    createdAtIdx: index('idx_styles_created_at').on(table.createdAt.desc()),
    isPublicIdx: index('idx_styles_is_public').on(table.isPublic),
    isTemplateIdx: index('idx_styles_is_template').on(table.isTemplate),
    nameIdx: index('idx_styles_name').on(table.name),
    parentIdIdx: index('idx_styles_parent_id').on(table.parentId),
    teamIdIdx: index('idx_styles_team_id').on(table.teamId),
    usageCountIdx: index('idx_styles_usage_count').on(table.usageCount.desc()),
  })
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
  (table) => ({
    providerModelIdx: index('idx_style_adaptations_provider_model').on(
      table.modelProvider,
      table.modelName
    ),
    styleIdIdx: index('idx_style_adaptations_style_id').on(table.styleId),
  })
);

/**
 * Characters library
 * LoRA models and character definitions
 */
export const characters = sqliteTable(
  'characters',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text({ length: 255 }).notNull(),
    loraUrl: text('lora_url'),
    config: text({ mode: 'json' }).default('{}'),
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
  (table) => ({
    nameIdx: index('idx_characters_name').on(table.name),
    teamIdIdx: index('idx_characters_team_id').on(table.teamId),
  })
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
  (table) => ({
    nameIdx: index('idx_vfx_name').on(table.name),
    teamIdIdx: index('idx_vfx_team_id').on(table.teamId),
  })
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
  (table) => ({
    nameIdx: index('idx_audio_name').on(table.name),
    teamIdIdx: index('idx_audio_team_id').on(table.teamId),
  })
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
