ALTER TABLE `frames` ADD `audio_url` text;--> statement-breakpoint
ALTER TABLE `frames` ADD `audio_path` text;--> statement-breakpoint
ALTER TABLE `frames` ADD `audio_status` text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `frames` ADD `audio_workflow_run_id` text;--> statement-breakpoint
ALTER TABLE `frames` ADD `audio_generated_at` integer;--> statement-breakpoint
ALTER TABLE `frames` ADD `audio_error` text;--> statement-breakpoint
ALTER TABLE `frames` ADD `audio_model` text(100);--> statement-breakpoint
ALTER TABLE `sequences` ADD `music_url` text;--> statement-breakpoint
ALTER TABLE `sequences` ADD `music_path` text;--> statement-breakpoint
ALTER TABLE `sequences` ADD `music_status` text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `sequences` ADD `music_generated_at` integer;--> statement-breakpoint
ALTER TABLE `sequences` ADD `music_error` text;--> statement-breakpoint
ALTER TABLE `sequences` ADD `music_model` text(100);