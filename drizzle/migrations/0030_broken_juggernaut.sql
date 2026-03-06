PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`title` text(500) NOT NULL,
	`script` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	`updated_by` text,
	`style_id` text NOT NULL,
	`aspect_ratio` text(10) DEFAULT '16:9' NOT NULL,
	`analysis_model` text(100) DEFAULT 'anthropic/claude-haiku-4.5' NOT NULL,
	`analysis_duration_ms` integer DEFAULT 0 NOT NULL,
	`image_model` text(100) DEFAULT 'nano_banana_pro' NOT NULL,
	`video_model` text(100) DEFAULT 'kling_v3_pro' NOT NULL,
	`workflow` text(100),
	`merged_video_url` text,
	`merged_video_path` text,
	`merged_video_status` text DEFAULT 'pending',
	`merged_video_generated_at` integer,
	`merged_video_error` text,
	`music_url` text,
	`music_path` text,
	`music_status` text DEFAULT 'pending',
	`music_generated_at` integer,
	`music_error` text,
	`music_model` text(100),
	`music_prompt` text,
	`music_tags` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_sequences`("id", "team_id", "title", "script", "status", "created_at", "updated_at", "created_by", "updated_by", "style_id", "aspect_ratio", "analysis_model", "analysis_duration_ms", "image_model", "video_model", "workflow", "merged_video_url", "merged_video_path", "merged_video_status", "merged_video_generated_at", "merged_video_error", "music_url", "music_path", "music_status", "music_generated_at", "music_error", "music_model", "music_prompt", "music_tags") SELECT "id", "team_id", "title", "script", "status", "created_at", "updated_at", "created_by", "updated_by", "style_id", "aspect_ratio", "analysis_model", "analysis_duration_ms", "image_model", "video_model", "workflow", "merged_video_url", "merged_video_path", "merged_video_status", "merged_video_generated_at", "merged_video_error", "music_url", "music_path", "music_status", "music_generated_at", "music_error", "music_model", "music_prompt", "music_tags" FROM `sequences`;--> statement-breakpoint
DROP TABLE `sequences`;--> statement-breakpoint
ALTER TABLE `__new_sequences` RENAME TO `sequences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_sequences_created_at` ON `sequences` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sequences_status` ON `sequences` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sequences_style_id` ON `sequences` (`style_id`);--> statement-breakpoint
CREATE INDEX `idx_sequences_team_id` ON `sequences` (`team_id`);--> statement-breakpoint
CREATE TABLE `__new_team_billing_settings` (
	`team_id` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text,
	`auto_top_up_enabled` integer DEFAULT true NOT NULL,
	`auto_top_up_threshold_usd` real DEFAULT 5,
	`auto_top_up_amount_usd` real DEFAULT 25,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_team_billing_settings`("team_id", "stripe_customer_id", "auto_top_up_enabled", "auto_top_up_threshold_usd", "auto_top_up_amount_usd", "updated_at") SELECT "team_id", "stripe_customer_id", "auto_top_up_enabled", "auto_top_up_threshold_usd", "auto_top_up_amount_usd", "updated_at" FROM `team_billing_settings`;--> statement-breakpoint
DROP TABLE `team_billing_settings`;--> statement-breakpoint
ALTER TABLE `__new_team_billing_settings` RENAME TO `team_billing_settings`;--> statement-breakpoint
ALTER TABLE `frames` ADD `variant_workflow_run_id` text;