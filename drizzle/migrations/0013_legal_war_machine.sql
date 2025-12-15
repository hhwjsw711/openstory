CREATE TABLE `character_media` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`path` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `library_characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_character_media_character_id` ON `character_media` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_character_media_type` ON `character_media` (`type`);--> statement-breakpoint
CREATE TABLE `character_sheets` (
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
	FOREIGN KEY (`character_id`) REFERENCES `library_characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_character_sheets_character_id` ON `character_sheets` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_character_sheets_is_default` ON `character_sheets` (`is_default`);--> statement-breakpoint
CREATE TABLE `library_characters` (
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
CREATE INDEX `idx_library_characters_team_id` ON `library_characters` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_library_characters_name` ON `library_characters` (`name`);--> statement-breakpoint
CREATE INDEX `idx_library_characters_is_favorite` ON `library_characters` (`is_favorite`);--> statement-breakpoint
CREATE TABLE `sequence_character_usages` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`character_sheet_id` text,
	`sequence_id` text NOT NULL,
	`scene_id` text,
	`frame_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `library_characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_sheet_id`) REFERENCES `character_sheets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`frame_id`) REFERENCES `frames`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_sequence_character_usages_character_id` ON `sequence_character_usages` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_sequence_character_usages_sequence_id` ON `sequence_character_usages` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `idx_sequence_character_usages_frame_id` ON `sequence_character_usages` (`frame_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sequence_character_usages_seq_scene_char_key` ON `sequence_character_usages` (`sequence_id`,`scene_id`,`character_id`);--> statement-breakpoint
DROP TABLE `credits`;--> statement-breakpoint
DROP TABLE `fal_requests`;--> statement-breakpoint
DROP TABLE `letzai_requests`;--> statement-breakpoint
DROP TABLE `script_analysis_audit`;--> statement-breakpoint
DROP TABLE `style_adaptations`;--> statement-breakpoint
DROP TABLE `transactions`;