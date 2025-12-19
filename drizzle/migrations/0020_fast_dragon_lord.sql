ALTER TABLE `characters` RENAME TO `talent`;--> statement-breakpoint
ALTER TABLE `character_media` RENAME TO `talent_media`;--> statement-breakpoint
ALTER TABLE `character_sheets` RENAME TO `talent_sheets`;--> statement-breakpoint
ALTER TABLE `talent` RENAME COLUMN "is_human_generated" TO "is_human";--> statement-breakpoint
ALTER TABLE `talent_media` RENAME COLUMN "character_id" TO "talent_id";--> statement-breakpoint
ALTER TABLE `talent_sheets` RENAME COLUMN "character_id" TO "talent_id";--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`talent_id` text NOT NULL,
	`sequence_character_id` text NOT NULL,
	`talent_sheet_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`talent_id`) REFERENCES `talent`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sequence_character_id`) REFERENCES `sequence_characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`talent_sheet_id`) REFERENCES `talent_sheets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_roles_talent_id` ON `roles` (`talent_id`);--> statement-breakpoint
CREATE INDEX `idx_roles_sequence_character_id` ON `roles` (`sequence_character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `roles_talent_sequence_character_key` ON `roles` (`talent_id`,`sequence_character_id`);--> statement-breakpoint
DROP TABLE `sequence_character_usages`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_talent` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`description` text,
	`image_url` text,
	`image_path` text,
	`is_favorite` integer DEFAULT false,
	`is_human` integer DEFAULT false,
	`is_in_team_library` integer DEFAULT false,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_talent`("id", "team_id", "name", "description", "image_url", "image_path", "is_favorite", "is_human", "is_in_team_library", "created_by", "created_at", "updated_at") SELECT "id", "team_id", "name", "description", "image_url", "image_path", "is_favorite", "is_human", true, "created_by", "created_at", "updated_at" FROM `talent`;--> statement-breakpoint
DROP TABLE `talent`;--> statement-breakpoint
ALTER TABLE `__new_talent` RENAME TO `talent`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_talent_team_id` ON `talent` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_talent_name` ON `talent` (`name`);--> statement-breakpoint
CREATE INDEX `idx_talent_is_favorite` ON `talent` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_talent_is_in_team_library` ON `talent` (`is_in_team_library`);--> statement-breakpoint
DROP INDEX `idx_character_media_character_id`;--> statement-breakpoint
DROP INDEX `idx_character_media_type`;--> statement-breakpoint
CREATE INDEX `idx_talent_media_talent_id` ON `talent_media` (`talent_id`);--> statement-breakpoint
CREATE INDEX `idx_talent_media_type` ON `talent_media` (`type`);--> statement-breakpoint
ALTER TABLE `talent_media` ALTER COLUMN "talent_id" TO "talent_id" text NOT NULL REFERENCES talent(id) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX `idx_character_sheets_character_id`;--> statement-breakpoint
DROP INDEX `idx_character_sheets_is_default`;--> statement-breakpoint
CREATE INDEX `idx_talent_sheets_talent_id` ON `talent_sheets` (`talent_id`);--> statement-breakpoint
CREATE INDEX `idx_talent_sheets_is_default` ON `talent_sheets` (`is_default`);--> statement-breakpoint
ALTER TABLE `talent_sheets` ALTER COLUMN "talent_id" TO "talent_id" text NOT NULL REFERENCES talent(id) ON DELETE cascade ON UPDATE no action;