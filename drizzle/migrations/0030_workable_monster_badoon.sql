CREATE TABLE `oauth_states` (
	`team_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
DROP INDEX "account_userId_idx";--> statement-breakpoint
DROP INDEX "idx_audio_name";--> statement-breakpoint
DROP INDEX "idx_audio_team_id";--> statement-breakpoint
DROP INDEX "idx_character_sheets_character_id";--> statement-breakpoint
DROP INDEX "idx_character_sheets_is_default";--> statement-breakpoint
DROP INDEX "idx_characters_sequence_id";--> statement-breakpoint
DROP INDEX "idx_characters_talent_id";--> statement-breakpoint
DROP INDEX "characters_sequence_character_key";--> statement-breakpoint
DROP INDEX "idx_frame_characters_frame_id";--> statement-breakpoint
DROP INDEX "idx_frame_characters_character_id";--> statement-breakpoint
DROP INDEX "frame_characters_frame_character_key";--> statement-breakpoint
DROP INDEX "idx_frame_locations_frame_id";--> statement-breakpoint
DROP INDEX "idx_frame_locations_location_id";--> statement-breakpoint
DROP INDEX "frame_locations_frame_location_key";--> statement-breakpoint
DROP INDEX "idx_frames_order";--> statement-breakpoint
DROP INDEX "idx_frames_sequence_id";--> statement-breakpoint
DROP INDEX "frames_sequence_id_order_index_key";--> statement-breakpoint
DROP INDEX "idx_location_library_team_id";--> statement-breakpoint
DROP INDEX "idx_location_library_name";--> statement-breakpoint
DROP INDEX "idx_location_sheets_location_id";--> statement-breakpoint
DROP INDEX "idx_location_sheets_is_default";--> statement-breakpoint
DROP INDEX "passkey_userId_idx";--> statement-breakpoint
DROP INDEX "passkey_credentialID_idx";--> statement-breakpoint
DROP INDEX "idx_sequence_locations_sequence_id";--> statement-breakpoint
DROP INDEX "idx_sequence_locations_library_location_id";--> statement-breakpoint
DROP INDEX "sequence_locations_sequence_location_key";--> statement-breakpoint
DROP INDEX "idx_sequences_created_at";--> statement-breakpoint
DROP INDEX "idx_sequences_status";--> statement-breakpoint
DROP INDEX "idx_sequences_style_id";--> statement-breakpoint
DROP INDEX "idx_sequences_team_id";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "session_userId_idx";--> statement-breakpoint
DROP INDEX "idx_styles_team_id";--> statement-breakpoint
DROP INDEX "idx_talent_team_id";--> statement-breakpoint
DROP INDEX "idx_talent_name";--> statement-breakpoint
DROP INDEX "idx_talent_is_favorite";--> statement-breakpoint
DROP INDEX "idx_talent_is_in_team_library";--> statement-breakpoint
DROP INDEX "idx_talent_media_talent_id";--> statement-breakpoint
DROP INDEX "idx_talent_media_type";--> statement-breakpoint
DROP INDEX "idx_talent_sheets_talent_id";--> statement-breakpoint
DROP INDEX "idx_talent_sheets_is_default";--> statement-breakpoint
DROP INDEX "idx_team_api_keys_team_provider";--> statement-breakpoint
DROP INDEX "idx_team_api_keys_team_id";--> statement-breakpoint
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
DROP INDEX "idx_transactions_team_id";--> statement-breakpoint
DROP INDEX "idx_transactions_user_id";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "verification_identifier_idx";--> statement-breakpoint
DROP INDEX "idx_vfx_name";--> statement-breakpoint
DROP INDEX "idx_vfx_team_id";--> statement-breakpoint
ALTER TABLE `sequences` ALTER COLUMN "video_model" TO "video_model" text(100) NOT NULL DEFAULT 'kling_v3_pro';--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_audio_name` ON `audio` (`name`);--> statement-breakpoint
CREATE INDEX `idx_audio_team_id` ON `audio` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_character_sheets_character_id` ON `character_sheets` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_character_sheets_is_default` ON `character_sheets` (`is_default`);--> statement-breakpoint
CREATE INDEX `idx_characters_sequence_id` ON `characters` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `idx_characters_talent_id` ON `characters` (`talent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `characters_sequence_character_key` ON `characters` (`sequence_id`,`character_id`);--> statement-breakpoint
CREATE INDEX `idx_frame_characters_frame_id` ON `frame_characters` (`frame_id`);--> statement-breakpoint
CREATE INDEX `idx_frame_characters_character_id` ON `frame_characters` (`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `frame_characters_frame_character_key` ON `frame_characters` (`frame_id`,`character_id`);--> statement-breakpoint
CREATE INDEX `idx_frame_locations_frame_id` ON `frame_locations` (`frame_id`);--> statement-breakpoint
CREATE INDEX `idx_frame_locations_location_id` ON `frame_locations` (`location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `frame_locations_frame_location_key` ON `frame_locations` (`frame_id`,`location_id`);--> statement-breakpoint
CREATE INDEX `idx_frames_order` ON `frames` (`sequence_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_frames_sequence_id` ON `frames` (`sequence_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `frames_sequence_id_order_index_key` ON `frames` (`sequence_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_location_library_team_id` ON `location_library` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_location_library_name` ON `location_library` (`name`);--> statement-breakpoint
CREATE INDEX `idx_location_sheets_location_id` ON `location_sheets` (`location_id`);--> statement-breakpoint
CREATE INDEX `idx_location_sheets_is_default` ON `location_sheets` (`is_default`);--> statement-breakpoint
CREATE INDEX `passkey_userId_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkey_credentialID_idx` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `idx_sequence_locations_sequence_id` ON `sequence_locations` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `idx_sequence_locations_library_location_id` ON `sequence_locations` (`library_location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sequence_locations_sequence_location_key` ON `sequence_locations` (`sequence_id`,`location_id`);--> statement-breakpoint
CREATE INDEX `idx_sequences_created_at` ON `sequences` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sequences_status` ON `sequences` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sequences_style_id` ON `sequences` (`style_id`);--> statement-breakpoint
CREATE INDEX `idx_sequences_team_id` ON `sequences` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_styles_team_id` ON `styles` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_talent_team_id` ON `talent` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_talent_name` ON `talent` (`name`);--> statement-breakpoint
CREATE INDEX `idx_talent_is_favorite` ON `talent` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_talent_is_in_team_library` ON `talent` (`is_in_team_library`);--> statement-breakpoint
CREATE INDEX `idx_talent_media_talent_id` ON `talent_media` (`talent_id`);--> statement-breakpoint
CREATE INDEX `idx_talent_media_type` ON `talent_media` (`type`);--> statement-breakpoint
CREATE INDEX `idx_talent_sheets_talent_id` ON `talent_sheets` (`talent_id`);--> statement-breakpoint
CREATE INDEX `idx_talent_sheets_is_default` ON `talent_sheets` (`is_default`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_api_keys_team_provider` ON `team_api_keys` (`team_id`,`provider`);--> statement-breakpoint
CREATE INDEX `idx_team_api_keys_team_id` ON `team_api_keys` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_email` ON `team_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_expires_at` ON `team_invitations` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_status` ON `team_invitations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_team_id` ON `team_invitations` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_invitations_token` ON `team_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_team_invitations_unique_pending` ON `team_invitations` (`team_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_team_members_team_id` ON `team_members` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_team_members_user_id` ON `team_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_teams_slug` ON `teams` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_transactions_created_at` ON `transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_transactions_type` ON `transactions` (`type`);--> statement-breakpoint
CREATE INDEX `idx_transactions_team_id` ON `transactions` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_id` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `idx_vfx_name` ON `vfx` (`name`);--> statement-breakpoint
CREATE INDEX `idx_vfx_team_id` ON `vfx` (`team_id`);--> statement-breakpoint
ALTER TABLE `team_billing_settings` ALTER COLUMN "auto_top_up_enabled" TO "auto_top_up_enabled" integer NOT NULL DEFAULT true;