ALTER TABLE `library_characters` RENAME TO `characters`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`description` text,
	`is_favorite` integer DEFAULT false,
	`is_human_generated` integer DEFAULT false,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_characters`("id", "team_id", "name", "description", "is_favorite", "is_human_generated", "created_by", "created_at", "updated_at") SELECT "id", "team_id", "name", "description", "is_favorite", "is_human_generated", "created_by", "created_at", "updated_at" FROM `characters`;--> statement-breakpoint
DROP TABLE `characters`;--> statement-breakpoint
ALTER TABLE `__new_characters` RENAME TO `characters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_library_characters_team_id` ON `characters` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_library_characters_name` ON `characters` (`name`);--> statement-breakpoint
CREATE INDEX `idx_library_characters_is_favorite` ON `characters` (`is_favorite`);--> statement-breakpoint
CREATE TABLE `__new_character_media` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`path` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_character_media`("id", "character_id", "type", "url", "path", "metadata", "created_at", "updated_at") SELECT "id", "character_id", "type", "url", "path", "metadata", "created_at", "updated_at" FROM `character_media`;--> statement-breakpoint
DROP TABLE `character_media`;--> statement-breakpoint
ALTER TABLE `__new_character_media` RENAME TO `character_media`;--> statement-breakpoint
CREATE INDEX `idx_character_media_character_id` ON `character_media` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_character_media_type` ON `character_media` (`type`);--> statement-breakpoint
CREATE TABLE `__new_character_sheets` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`image_url` text,
	`image_path` text,
	`metadata` text,
	`is_default` integer DEFAULT false,
	`source` text DEFAULT 'manual_upload' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_character_sheets`("id", "character_id", "name", "image_url", "image_path", "metadata", "is_default", "source", "created_at", "updated_at") SELECT "id", "character_id", "name", "image_url", "image_path", "metadata", "is_default", "source", "created_at", "updated_at" FROM `character_sheets`;--> statement-breakpoint
DROP TABLE `character_sheets`;--> statement-breakpoint
ALTER TABLE `__new_character_sheets` RENAME TO `character_sheets`;--> statement-breakpoint
CREATE INDEX `idx_character_sheets_character_id` ON `character_sheets` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_character_sheets_is_default` ON `character_sheets` (`is_default`);--> statement-breakpoint
CREATE TABLE `__new_sequence_character_usages` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`character_sheet_id` text,
	`sequence_id` text NOT NULL,
	`scene_id` text,
	`frame_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_sheet_id`) REFERENCES `character_sheets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`frame_id`) REFERENCES `frames`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_sequence_character_usages`("id", "character_id", "character_sheet_id", "sequence_id", "scene_id", "frame_id", "created_at", "updated_at") SELECT "id", "character_id", "character_sheet_id", "sequence_id", "scene_id", "frame_id", "created_at", "updated_at" FROM `sequence_character_usages`;--> statement-breakpoint
DROP TABLE `sequence_character_usages`;--> statement-breakpoint
ALTER TABLE `__new_sequence_character_usages` RENAME TO `sequence_character_usages`;--> statement-breakpoint
CREATE INDEX `idx_sequence_character_usages_character_id` ON `sequence_character_usages` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_sequence_character_usages_sequence_id` ON `sequence_character_usages` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `idx_sequence_character_usages_frame_id` ON `sequence_character_usages` (`frame_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sequence_character_usages_seq_scene_char_key` ON `sequence_character_usages` (`sequence_id`,`scene_id`,`character_id`);