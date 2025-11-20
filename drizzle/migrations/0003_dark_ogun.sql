DROP INDEX `idx_account_provider`;--> statement-breakpoint
DROP INDEX `idx_account_user_id`;--> statement-breakpoint
DROP INDEX `idx_session_expires_at`;--> statement-breakpoint
DROP INDEX `idx_session_token`;--> statement-breakpoint
DROP INDEX `idx_session_user_id`;--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
DROP INDEX `idx_user_email`;--> statement-breakpoint
DROP INDEX "idx_audio_name";--> statement-breakpoint
DROP INDEX "idx_audio_team_id";--> statement-breakpoint
DROP INDEX "idx_characters_name";--> statement-breakpoint
DROP INDEX "idx_characters_team_id";--> statement-breakpoint
DROP INDEX "idx_fal_requests_created_at";--> statement-breakpoint
DROP INDEX "idx_fal_requests_job_id";--> statement-breakpoint
DROP INDEX "idx_fal_requests_model";--> statement-breakpoint
DROP INDEX "idx_fal_requests_status";--> statement-breakpoint
DROP INDEX "idx_fal_requests_team_id";--> statement-breakpoint
DROP INDEX "idx_fal_requests_user_id";--> statement-breakpoint
DROP INDEX "idx_frames_order";--> statement-breakpoint
DROP INDEX "idx_frames_sequence_id";--> statement-breakpoint
DROP INDEX "frames_sequence_id_order_index_key";--> statement-breakpoint
DROP INDEX "idx_letzai_requests_created_at";--> statement-breakpoint
DROP INDEX "idx_letzai_requests_endpoint";--> statement-breakpoint
DROP INDEX "idx_letzai_requests_job_id";--> statement-breakpoint
DROP INDEX "idx_letzai_requests_status";--> statement-breakpoint
DROP INDEX "idx_letzai_requests_team_id";--> statement-breakpoint
DROP INDEX "idx_letzai_requests_team_status_created";--> statement-breakpoint
DROP INDEX "idx_letzai_requests_user_id";--> statement-breakpoint
DROP INDEX "script_analysis_audit_sequence_id_idx";--> statement-breakpoint
DROP INDEX "script_analysis_audit_team_id_idx";--> statement-breakpoint
DROP INDEX "script_analysis_audit_created_at_idx";--> statement-breakpoint
DROP INDEX "script_analysis_audit_status_idx";--> statement-breakpoint
DROP INDEX "idx_sequences_created_at";--> statement-breakpoint
DROP INDEX "idx_sequences_status";--> statement-breakpoint
DROP INDEX "idx_sequences_style_id";--> statement-breakpoint
DROP INDEX "idx_sequences_team_id";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "idx_style_adaptations_provider_model";--> statement-breakpoint
DROP INDEX "idx_style_adaptations_style_id";--> statement-breakpoint
DROP INDEX "idx_styles_category";--> statement-breakpoint
DROP INDEX "idx_styles_created_at";--> statement-breakpoint
DROP INDEX "idx_styles_is_public";--> statement-breakpoint
DROP INDEX "idx_styles_is_template";--> statement-breakpoint
DROP INDEX "idx_styles_name";--> statement-breakpoint
DROP INDEX "idx_styles_parent_id";--> statement-breakpoint
DROP INDEX "idx_styles_team_id";--> statement-breakpoint
DROP INDEX "idx_styles_usage_count";--> statement-breakpoint
DROP INDEX "idx_team_invitations_email";--> statement-breakpoint
DROP INDEX "idx_team_invitations_expires_at";--> statement-breakpoint
DROP INDEX "idx_team_invitations_status";--> statement-breakpoint
DROP INDEX "idx_team_invitations_team_id";--> statement-breakpoint
DROP INDEX "idx_team_invitations_token";--> statement-breakpoint
DROP INDEX "idx_team_invitations_unique_pending";--> statement-breakpoint
DROP INDEX "idx_team_members_team_id";--> statement-breakpoint
DROP INDEX "idx_team_members_user_id";--> statement-breakpoint
DROP INDEX "idx_teams_slug";--> statement-breakpoint
DROP INDEX "idx_transactions_created_at";--> statement-breakpoint
DROP INDEX "idx_transactions_type";--> statement-breakpoint
DROP INDEX "idx_transactions_user_id";--> statement-breakpoint
DROP INDEX "idx_vfx_name";--> statement-breakpoint
DROP INDEX "idx_vfx_team_id";--> statement-breakpoint
ALTER TABLE `user` ALTER COLUMN "name" TO "name" text NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_audio_name` ON `audio` (`name`);--> statement-breakpoint
CREATE INDEX `idx_audio_team_id` ON `audio` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_characters_name` ON `characters` (`name`);--> statement-breakpoint
CREATE INDEX `idx_characters_team_id` ON `characters` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_fal_requests_job_id` ON `fal_requests` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_fal_requests_model` ON `fal_requests` (`model`);--> statement-breakpoint
CREATE INDEX `idx_fal_requests_status` ON `fal_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_fal_requests_team_id` ON `fal_requests` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_fal_requests_user_id` ON `fal_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_frames_order` ON `frames` (`sequence_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_frames_sequence_id` ON `frames` (`sequence_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `frames_sequence_id_order_index_key` ON `frames` (`sequence_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_endpoint` ON `letzai_requests` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_job_id` ON `letzai_requests` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_status` ON `letzai_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_team_id` ON `letzai_requests` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_letzai_requests_user_id` ON `letzai_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `script_analysis_audit_sequence_id_idx` ON `script_analysis_audit` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `script_analysis_audit_team_id_idx` ON `script_analysis_audit` (`team_id`);--> statement-breakpoint
CREATE INDEX `script_analysis_audit_status_idx` ON `script_analysis_audit` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sequences_status` ON `sequences` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sequences_style_id` ON `sequences` (`style_id`);--> statement-breakpoint
CREATE INDEX `idx_sequences_team_id` ON `sequences` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_style_adaptations_provider_model` ON `style_adaptations` (`model_provider`,`model_name`);--> statement-breakpoint
CREATE INDEX `idx_style_adaptations_style_id` ON `style_adaptations` (`style_id`);--> statement-breakpoint
CREATE INDEX `idx_styles_category` ON `styles` (`category`);--> statement-breakpoint
CREATE INDEX `idx_styles_is_public` ON `styles` (`is_public`);--> statement-breakpoint
CREATE INDEX `idx_styles_is_template` ON `styles` (`is_template`);--> statement-breakpoint
CREATE INDEX `idx_styles_name` ON `styles` (`name`);--> statement-breakpoint
CREATE INDEX `idx_styles_parent_id` ON `styles` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_styles_team_id` ON `styles` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_email` ON `team_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_expires_at` ON `team_invitations` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_status` ON `team_invitations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_team_id` ON `team_invitations` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_invitations_token` ON `team_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_unique_pending` ON `team_invitations` (`team_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_team_members_team_id` ON `team_members` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_team_members_user_id` ON `team_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_teams_slug` ON `teams` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_transactions_type` ON `transactions` (`type`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_id` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `idx_vfx_name` ON `vfx` (`name`);--> statement-breakpoint
CREATE INDEX `idx_vfx_team_id` ON `vfx` (`team_id`);--> statement-breakpoint
DROP INDEX `idx_verification_expires_at`;--> statement-breakpoint
DROP INDEX `idx_verification_identifier`;