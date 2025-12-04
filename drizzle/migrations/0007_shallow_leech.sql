-- Recreate styles table without parent_id
PRAGMA foreign_keys=OFF;--> statement-breakpoint

CREATE TABLE `styles_new` (
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
  `preview_url` text,
  `usage_count` integer DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `created_by` text,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade,
  FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null
);--> statement-breakpoint

INSERT INTO `styles_new` SELECT `id`, `team_id`, `name`, `description`, `config`, `category`, `tags`, `is_public`, `is_template`, `version`, `preview_url`, `usage_count`, `created_at`, `updated_at`, `created_by` FROM `styles`;--> statement-breakpoint

DROP TABLE `styles`;--> statement-breakpoint

ALTER TABLE `styles_new` RENAME TO `styles`;--> statement-breakpoint

CREATE INDEX `idx_styles_team_id` ON `styles` (`team_id`);--> statement-breakpoint

PRAGMA foreign_keys=ON;
