CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_account_provider` ON `account` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `idx_account_user_id` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `audio` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`file_url` text NOT NULL,
	`duration_ms` integer,
	`metadata` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audio_name` ON `audio` (`name`);--> statement-breakpoint
CREATE INDEX `idx_audio_team_id` ON `audio` (`team_id`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`lora_url` text,
	`config` text DEFAULT '{}',
	`preview_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_characters_name` ON `characters` (`name`);--> statement-breakpoint
CREATE INDEX `idx_characters_team_id` ON `characters` (`team_id`);--> statement-breakpoint
CREATE TABLE `credits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "positive_balance" CHECK("credits"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE `fal_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`team_id` text,
	`user_id` text,
	`model` text(255) NOT NULL,
	`request_payload` text NOT NULL,
	`response_data` text,
	`cost_credits` real DEFAULT 0,
	`latency_ms` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_fal_requests_created_at` ON `fal_requests` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `idx_fal_requests_job_id` ON `fal_requests` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_fal_requests_model` ON `fal_requests` (`model`);--> statement-breakpoint
CREATE INDEX `idx_fal_requests_status` ON `fal_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_fal_requests_team_id` ON `fal_requests` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_fal_requests_user_id` ON `fal_requests` (`user_id`);--> statement-breakpoint
CREATE TABLE `frames` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`description` text,
	`duration_ms` integer DEFAULT 3000,
	`thumbnail_url` text,
	`thumbnail_path` text,
	`video_url` text,
	`video_path` text,
	`thumbnail_status` text DEFAULT 'pending',
	`thumbnail_workflow_run_id` text,
	`thumbnail_generated_at` integer,
	`thumbnail_error` text,
	`video_status` text DEFAULT 'pending',
	`video_workflow_run_id` text,
	`video_generated_at` integer,
	`video_error` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_frames_order` ON `frames` (`sequence_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_frames_sequence_id` ON `frames` (`sequence_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `frames_sequence_id_order_index_key` ON `frames` (`sequence_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `letzai_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`team_id` text,
	`user_id` text,
	`endpoint` text NOT NULL,
	`model` text,
	`request_payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`response_data` text,
	`error` text,
	`cost_credits` real,
	`latency_ms` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_created_at` ON `letzai_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_endpoint` ON `letzai_requests` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_job_id` ON `letzai_requests` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_status` ON `letzai_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_team_id` ON `letzai_requests` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_team_status_created` ON `letzai_requests` (`team_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_user_id` ON `letzai_requests` (`user_id`);--> statement-breakpoint
CREATE TABLE `script_analysis_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_script` text NOT NULL,
	`system_prompt_version` text(16) NOT NULL,
	`user_prompt` text NOT NULL,
	`style_config` text NOT NULL,
	`model` text(100) NOT NULL,
	`raw_output` text,
	`parsed_output` text,
	`api_error` text,
	`parse_error` text,
	`token_usage` text,
	`duration_ms` integer NOT NULL,
	`status` text(20) NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `script_analysis_audit_sequence_id_idx` ON `script_analysis_audit` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `script_analysis_audit_team_id_idx` ON `script_analysis_audit` (`team_id`);--> statement-breakpoint
CREATE INDEX `script_analysis_audit_created_at_idx` ON `script_analysis_audit` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `script_analysis_audit_status_idx` ON `script_analysis_audit` (`status`);--> statement-breakpoint
CREATE TABLE `sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`title` text(500) NOT NULL,
	`script` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	`updated_by` text,
	`style_id` text NOT NULL,
	`aspect_ratio` text(10) DEFAULT '16:9' NOT NULL,
	`analysis_model` text(100) DEFAULT 'anthropic/claude-haiku-4.5' NOT NULL,
	`analysis_duration_ms` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_sequences_created_at` ON `sequences` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `idx_sequences_status` ON `sequences` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sequences_style_id` ON `sequences` (`style_id`);--> statement-breakpoint
CREATE INDEX `idx_sequences_team_id` ON `sequences` (`team_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_session_expires_at` ON `session` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_session_token` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user_id` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `style_adaptations` (
	`id` text PRIMARY KEY NOT NULL,
	`style_id` text NOT NULL,
	`model_provider` text(100) NOT NULL,
	`model_name` text(100) NOT NULL,
	`adapted_config` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_style_adaptations_provider_model` ON `style_adaptations` (`model_provider`,`model_name`);--> statement-breakpoint
CREATE INDEX `idx_style_adaptations_style_id` ON `style_adaptations` (`style_id`);--> statement-breakpoint
CREATE TABLE `styles` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`description` text,
	`config` text NOT NULL,
	`category` text(100),
	`tags` text,
	`is_public` integer DEFAULT false,
	`is_template` integer DEFAULT false,
	`version` integer DEFAULT 1,
	`parent_id` text,
	`preview_url` text,
	`usage_count` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `styles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_styles_category` ON `styles` (`category`);--> statement-breakpoint
CREATE INDEX `idx_styles_created_at` ON `styles` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `idx_styles_is_public` ON `styles` (`is_public`);--> statement-breakpoint
CREATE INDEX `idx_styles_is_template` ON `styles` (`is_template`);--> statement-breakpoint
CREATE INDEX `idx_styles_name` ON `styles` (`name`);--> statement-breakpoint
CREATE INDEX `idx_styles_parent_id` ON `styles` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_styles_team_id` ON `styles` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_styles_usage_count` ON `styles` ("usage_count" desc);--> statement-breakpoint
CREATE TABLE `team_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`email` text(255) NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`invited_by` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`token` text(255) NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`accepted_at` integer,
	`declined_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_team_invitations_email` ON `team_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_expires_at` ON `team_invitations` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_status` ON `team_invitations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_team_id` ON `team_invitations` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_invitations_token` ON `team_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_unique_pending` ON `team_invitations` (`team_id`,`email`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`team_id`, `user_id`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_team_members_team_id` ON `team_members` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_team_members_user_id` ON `team_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`slug` text(255) NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_teams_slug` ON `teams` (`slug`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`balance_after` real NOT NULL,
	`metadata` text,
	`description` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_created_at` ON `transactions` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `idx_transactions_type` ON `transactions` (`type`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_id` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`name` text,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`full_name` text,
	`avatar_url` text,
	`onboarding_completed` integer DEFAULT false,
	`access_code` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_email` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_verification_expires_at` ON `verification` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_verification_identifier` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `vfx` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`preset_config` text DEFAULT '{}' NOT NULL,
	`preview_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_vfx_name` ON `vfx` (`name`);--> statement-breakpoint
CREATE INDEX `idx_vfx_team_id` ON `vfx` (`team_id`);