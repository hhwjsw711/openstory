ALTER TABLE `locations` RENAME TO `sequence_locations`;--> statement-breakpoint
CREATE TABLE `location_library` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`description` text,
	`reference_image_url` text,
	`reference_image_path` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_location_library_team_id` ON `location_library` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_location_library_name` ON `location_library` (`name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sequence_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`library_location_id` text,
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
	FOREIGN KEY (`sequence_id`) REFERENCES `sequences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_location_id`) REFERENCES `location_library`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_sequence_locations`("id", "sequence_id", "library_location_id", "location_id", "name", "type", "time_of_day", "description", "architectural_style", "key_features", "color_palette", "lighting_setup", "ambiance", "consistency_tag", "first_mention_scene_id", "first_mention_text", "first_mention_line", "reference_image_url", "reference_image_path", "reference_status", "reference_generated_at", "reference_error", "created_at", "updated_at") SELECT "id", "sequence_id", NULL, "location_id", "name", "type", "time_of_day", "description", "architectural_style", "key_features", "color_palette", "lighting_setup", "ambiance", "consistency_tag", "first_mention_scene_id", "first_mention_text", "first_mention_line", "reference_image_url", "reference_image_path", "reference_status", "reference_generated_at", "reference_error", "created_at", "updated_at" FROM `sequence_locations`;--> statement-breakpoint
DROP TABLE `sequence_locations`;--> statement-breakpoint
ALTER TABLE `__new_sequence_locations` RENAME TO `sequence_locations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_sequence_locations_sequence_id` ON `sequence_locations` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `idx_sequence_locations_library_location_id` ON `sequence_locations` (`library_location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sequence_locations_sequence_location_key` ON `sequence_locations` (`sequence_id`,`location_id`);--> statement-breakpoint
CREATE TABLE `__new_frame_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`frame_id` text NOT NULL,
	`location_id` text NOT NULL,
	`location_sheet_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`frame_id`) REFERENCES `frames`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `sequence_locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_sheet_id`) REFERENCES `location_sheets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_frame_locations`("id", "frame_id", "location_id", "location_sheet_id", "created_at") SELECT "id", "frame_id", "location_id", "location_sheet_id", "created_at" FROM `frame_locations`;--> statement-breakpoint
DROP TABLE `frame_locations`;--> statement-breakpoint
ALTER TABLE `__new_frame_locations` RENAME TO `frame_locations`;--> statement-breakpoint
CREATE INDEX `idx_frame_locations_frame_id` ON `frame_locations` (`frame_id`);--> statement-breakpoint
CREATE INDEX `idx_frame_locations_location_id` ON `frame_locations` (`location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `frame_locations_frame_location_key` ON `frame_locations` (`frame_id`,`location_id`);--> statement-breakpoint
CREATE TABLE `__new_location_sheets` (
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
	FOREIGN KEY (`location_id`) REFERENCES `location_library`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_location_sheets`("id", "location_id", "name", "description", "image_url", "image_path", "is_default", "source", "created_at", "updated_at") SELECT "id", "location_id", "name", "description", "image_url", "image_path", "is_default", "source", "created_at", "updated_at" FROM `location_sheets`;--> statement-breakpoint
DROP TABLE `location_sheets`;--> statement-breakpoint
ALTER TABLE `__new_location_sheets` RENAME TO `location_sheets`;--> statement-breakpoint
CREATE INDEX `idx_location_sheets_location_id` ON `location_sheets` (`location_id`);--> statement-breakpoint
CREATE INDEX `idx_location_sheets_is_default` ON `location_sheets` (`is_default`);