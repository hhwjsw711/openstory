CREATE TABLE `team_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`provider` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`key_iv` text NOT NULL,
	`key_tag` text NOT NULL,
	`key_hint` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`added_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_api_keys_team_provider` ON `team_api_keys` (`team_id`,`provider`);--> statement-breakpoint
CREATE INDEX `idx_team_api_keys_team_id` ON `team_api_keys` (`team_id`);