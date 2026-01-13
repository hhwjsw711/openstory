CREATE TABLE `frame_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`frame_id` text NOT NULL,
	`location_id` text NOT NULL,
	`location_sheet_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`frame_id`) REFERENCES `frames`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_sheet_id`) REFERENCES `location_sheets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_frame_locations_frame_id` ON `frame_locations` (`frame_id`);--> statement-breakpoint
CREATE INDEX `idx_frame_locations_location_id` ON `frame_locations` (`location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `frame_locations_frame_location_key` ON `frame_locations` (`frame_id`,`location_id`);--> statement-breakpoint
CREATE TABLE `location_sheets` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`description` text,
	`image_url` text,
	`image_path` text,
	`is_default` integer DEFAULT false,
	`source` text DEFAULT 'manual_upload' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_location_sheets_location_id` ON `location_sheets` (`location_id`);--> statement-breakpoint
CREATE INDEX `idx_location_sheets_is_default` ON `location_sheets` (`is_default`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`location_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`type` text,
	`time_of_day` text,
	`description` text,
	`architectural_style` text,
	`key_features` text,
	`color_palette` text,
	`lighting_setup` text,
	`ambiance` text,
	`consistency_tag` text,
	`first_mention_scene_id` text,
	`first_mention_text` text,
	`first_mention_line` integer,
	`reference_image_url` text,
	`reference_image_path` text,
	`reference_status` text DEFAULT 'pending' NOT NULL,
	`reference_generated_at` integer,
	`reference_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_locations_sequence_id` ON `locations` (`sequence_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `locations_sequence_location_key` ON `locations` (`sequence_id`,`location_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`talent_id` text,
	`character_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`age` text NOT NULL,
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
INSERT INTO `__new_characters`("id", "sequence_id", "talent_id", "character_id", "name", "age", "gender", "ethnicity", "physical_description", "standard_clothing", "distinguishing_features", "consistency_tag", "first_mention_scene_id", "first_mention_text", "first_mention_line", "sheet_image_url", "sheet_image_path", "sheet_status", "sheet_generated_at", "sheet_error", "created_at", "updated_at") SELECT "id", "sequence_id", "talent_id", "character_id", "name", "age", "gender", "ethnicity", "physical_description", "standard_clothing", "distinguishing_features", "consistency_tag", "first_mention_scene_id", "first_mention_text", "first_mention_line", "sheet_image_url", "sheet_image_path", "sheet_status", "sheet_generated_at", "sheet_error", "created_at", "updated_at" FROM `characters`;--> statement-breakpoint
DROP TABLE `characters`;--> statement-breakpoint
ALTER TABLE `__new_characters` RENAME TO `characters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_characters_sequence_id` ON `characters` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `idx_characters_talent_id` ON `characters` (`talent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `characters_sequence_character_key` ON `characters` (`sequence_id`,`character_id`);