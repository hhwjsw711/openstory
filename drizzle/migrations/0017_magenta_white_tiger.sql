CREATE TABLE `passkey` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`public_key` text NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`created_at` integer,
	`aaguid` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkey_userId_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkey_credentialID_idx` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `idx_sequences_created_at` ON `sequences` (`created_at`);--> statement-breakpoint
DROP INDEX "idx_audio_name";--> statement-breakpoint
DROP INDEX "idx_audio_team_id";--> statement-breakpoint
DROP INDEX "idx_character_media_character_id";--> statement-breakpoint
DROP INDEX "idx_character_media_type";--> statement-breakpoint
DROP INDEX "idx_character_sheets_character_id";--> statement-breakpoint
DROP INDEX "idx_character_sheets_is_default";--> statement-breakpoint
DROP INDEX "idx_library_characters_team_id";--> statement-breakpoint
DROP INDEX "idx_library_characters_name";--> statement-breakpoint
DROP INDEX "idx_library_characters_is_favorite";--> statement-breakpoint
DROP INDEX "idx_frames_order";--> statement-breakpoint
DROP INDEX "idx_frames_sequence_id";--> statement-breakpoint
DROP INDEX "frames_sequence_id_order_index_key";--> statement-breakpoint
DROP INDEX "passkey_userId_idx";--> statement-breakpoint
DROP INDEX "passkey_credentialID_idx";--> statement-breakpoint
DROP INDEX "idx_sequence_character_usages_character_id";--> statement-breakpoint
DROP INDEX "idx_sequence_character_usages_sequence_id";--> statement-breakpoint
DROP INDEX "idx_sequence_character_usages_frame_id";--> statement-breakpoint
DROP INDEX "sequence_character_usages_seq_scene_char_key";--> statement-breakpoint
DROP INDEX "idx_sequence_characters_sequence_id";--> statement-breakpoint
DROP INDEX "sequence_characters_sequence_character_key";--> statement-breakpoint
DROP INDEX "idx_sequences_created_at";--> statement-breakpoint
DROP INDEX "idx_sequences_status";--> statement-breakpoint
DROP INDEX "idx_sequences_style_id";--> statement-breakpoint
DROP INDEX "idx_sequences_team_id";--> statement-breakpoint
DROP INDEX "idx_styles_team_id";--> statement-breakpoint
DROP INDEX "idx_team_invitations_email";--> statement-breakpoint
DROP INDEX "idx_team_invitations_expires_at";--> statement-breakpoint
DROP INDEX "idx_team_invitations_status";--> statement-breakpoint
DROP INDEX "idx_team_invitations_team_id";--> statement-breakpoint
DROP INDEX "idx_team_invitations_token";--> statement-breakpoint
DROP INDEX "idx_team_invitations_unique_pending";--> statement-breakpoint
DROP INDEX "idx_team_members_team_id";--> statement-breakpoint
DROP INDEX "idx_team_members_user_id";--> statement-breakpoint
DROP INDEX "idx_teams_slug";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "idx_vfx_name";--> statement-breakpoint
DROP INDEX "idx_vfx_team_id";--> statement-breakpoint
ALTER TABLE `account` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_audio_name` ON `audio` (`name`);--> statement-breakpoint
CREATE INDEX `idx_audio_team_id` ON `audio` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_character_media_character_id` ON `character_media` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_character_media_type` ON `character_media` (`type`);--> statement-breakpoint
CREATE INDEX `idx_character_sheets_character_id` ON `character_sheets` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_character_sheets_is_default` ON `character_sheets` (`is_default`);--> statement-breakpoint
CREATE INDEX `idx_library_characters_team_id` ON `characters` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_library_characters_name` ON `characters` (`name`);--> statement-breakpoint
CREATE INDEX `idx_library_characters_is_favorite` ON `characters` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_frames_order` ON `frames` (`sequence_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_frames_sequence_id` ON `frames` (`sequence_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `frames_sequence_id_order_index_key` ON `frames` (`sequence_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_sequence_character_usages_character_id` ON `sequence_character_usages` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_sequence_character_usages_sequence_id` ON `sequence_character_usages` (`sequence_id`);--> statement-breakpoint
CREATE INDEX `idx_sequence_character_usages_frame_id` ON `sequence_character_usages` (`frame_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sequence_character_usages_seq_scene_char_key` ON `sequence_character_usages` (`sequence_id`,`scene_id`,`character_id`);--> statement-breakpoint
CREATE INDEX `idx_sequence_characters_sequence_id` ON `sequence_characters` (`sequence_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sequence_characters_sequence_character_key` ON `sequence_characters` (`sequence_id`,`character_id`);--> statement-breakpoint
CREATE INDEX `idx_sequences_status` ON `sequences` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sequences_style_id` ON `sequences` (`style_id`);--> statement-breakpoint
CREATE INDEX `idx_sequences_team_id` ON `sequences` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `idx_vfx_name` ON `vfx` (`name`);--> statement-breakpoint
CREATE INDEX `idx_vfx_team_id` ON `vfx` (`team_id`);--> statement-breakpoint
ALTER TABLE `session` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));--> statement-breakpoint
ALTER TABLE `user` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));--> statement-breakpoint
ALTER TABLE `user` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));--> statement-breakpoint
ALTER TABLE `user` ALTER COLUMN "status" TO "status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `verification` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));--> statement-breakpoint
ALTER TABLE `verification` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer));