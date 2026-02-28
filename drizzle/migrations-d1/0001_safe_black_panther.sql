CREATE TABLE `oauth_states` (
	`team_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`expires_at` integer NOT NULL
);
