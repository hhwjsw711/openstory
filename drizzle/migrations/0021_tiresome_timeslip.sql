ALTER TABLE `sequence_characters` RENAME TO `characters`;--> statement-breakpoint
CREATE TABLE `character_sheets` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`image_url` text,
	`image_path` text,
	`is_default` integer DEFAULT false,
	`source` text DEFAULT 'manual_upload' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_character_sheets_character_id` ON `character_sheets` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_character_sheets_is_default` ON `character_sheets` (`is_default`);--> statement-breakpoint
CREATE TABLE `frame_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`frame_id` text NOT NULL,
	`character_id` text NOT NULL,
	`character_sheet_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`frame_id`) REFERENCES `frames`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_sheet_id`) REFERENCES `character_sheets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_frame_characters_frame_id` ON `frame_characters` (`frame_id`);--> statement-breakpoint
CREATE INDEX `idx_frame_characters_character_id` ON `frame_characters` (`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `frame_characters_frame_character_key` ON `frame_characters` (`frame_id`,`character_id`);--> statement-breakpoint
DROP TABLE `roles`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`talent_id` text,
	`character_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`age` text,
	`gender` text,
	`ethnicity` text,
	`physical_description` text,
	`standard_clothing` text,
	`distinguishing_features` text,
	`consistency_tag` text,
	`first_mention_scene_id` text,
	`first_mention_text` text,
	`first_mention_line` integer,
	`sheet_image_url` text,
	`sheet_image_path` text,
	`sheet_status` text DEFAULT 'pending' NOT NULL,
	`sheet_generated_at` integer,
	`sheet_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`talent_id`) REFERENCES `talent`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_characters`("id", "sequence_id", "talent_id", "character_id", "name", "age", "gender", "ethnicity", "physical_description", "standard_clothing", "distinguishing_features", "consistency_tag", "first_mention_scene_id", "first_mention_text", "first_mention_line", "sheet_image_url", "sheet_image_path", "sheet_status", "sheet_generated_at", "sheet_error", "created_at", "updated_at") SELECT "id", "sequence_id", NULL, "character_id", "name", json_extract("metadata", '$.age'), json_extract("metadata", '$.gender'), json_extract("metadata", '$.ethnicity'), json_extract("metadata", '$.physicalDescription'), json_extract("metadata", '$.standardClothing'), json_extract("metadata", '$.distinguishingFeatures'), json_extract("metadata", '$.consistencyTag'), json_extract("metadata", '$.firstMention.sceneId'), json_extract("metadata", '$.firstMention.originalText'), json_extract("metadata", '$.firstMention.lineNumber'), "sheet_image_url", "sheet_image_path", "sheet_status", "sheet_generated_at", "sheet_error", "created_at", "updated_at" FROM `characters`;--> statement-breakpoint
DROP TABLE `characters`;--> statement-breakpoint
ALTER TABLE `__new_characters` RENAME TO `characters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_characters_sequence_id` ON `characters` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `idx_characters_talent_id` ON `characters` (`talent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `characters_sequence_character_key` ON `characters` (`sequence_id`,`character_id`);