ALTER TABLE `sequences` ADD `merged_video_url` text;--> statement-breakpoint
ALTER TABLE `sequences` ADD `merged_video_path` text;--> statement-breakpoint
ALTER TABLE `sequences` ADD `merged_video_status` text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `sequences` ADD `merged_video_generated_at` integer;--> statement-breakpoint
ALTER TABLE `sequences` ADD `merged_video_error` text;--> statement-breakpoint
ALTER TABLE `sequences` ADD `merged_video_duration_ms` integer;