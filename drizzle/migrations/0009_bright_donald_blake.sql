-- Add sequence_characters table for storing extracted characters with reference sheets
CREATE TABLE `sequence_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`character_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`metadata` text NOT NULL,
	`sheet_image_url` text,
	`sheet_image_path` text,
	`sheet_status` text DEFAULT 'pending' NOT NULL,
	`sheet_workflow_run_id` text,
	`sheet_generated_at` integer,
	`sheet_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sequence_characters_sequence_id` ON `sequence_characters` (`sequence_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `sequence_characters_sequence_character_key` ON `sequence_characters` (`sequence_id`,`character_id`);
