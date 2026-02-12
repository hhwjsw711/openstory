CREATE TABLE `dag_workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`snapshot_id` text,
	`input_entity_refs` text,
	`started_at` integer,
	`completed_at` integer,
	`result` text,
	`error` text,
	FOREIGN KEY (`snapshot_id`) REFERENCES `workflow_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_dag_workflows_status` ON `dag_workflows` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dag_workflows_type` ON `dag_workflows` (`type`);--> statement-breakpoint
CREATE INDEX `idx_dag_workflows_snapshot` ON `dag_workflows` (`snapshot_id`);--> statement-breakpoint
CREATE TABLE `dependencies` (
	`dependent_id` text NOT NULL,
	`dependency_id` text NOT NULL,
	`dependency_type` text
);
--> statement-breakpoint
CREATE INDEX `idx_deps_dependent` ON `dependencies` (`dependent_id`);--> statement-breakpoint
CREATE INDEX `idx_deps_upstream` ON `dependencies` (`dependency_id`);--> statement-breakpoint
CREATE TABLE `entity_versions` (
	`id` text NOT NULL,
	`entity_id` text NOT NULL,
	`version` integer NOT NULL,
	`branch_name` text DEFAULT 'main' NOT NULL,
	`parent_version` integer,
	`content_hash` text NOT NULL,
	`data` text NOT NULL,
	`entity_type` text NOT NULL,
	`lifecycle_state` text DEFAULT 'valid' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_entity_versions_lookup` ON `entity_versions` (`entity_id`,`branch_name`,`version`);--> statement-breakpoint
CREATE INDEX `idx_entity_current` ON `entity_versions` (`entity_id`,`branch_name`);--> statement-breakpoint
CREATE INDEX `idx_entity_content_hash` ON `entity_versions` (`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_entity_type` ON `entity_versions` (`entity_type`);--> statement-breakpoint
CREATE TABLE `generation_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`input_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`claimed_by` text,
	`claimed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_queue_pending` ON `generation_queue` (`priority`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_queue_entity` ON `generation_queue` (`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_queue_status` ON `generation_queue` (`status`);--> statement-breakpoint
CREATE TABLE `generation_records` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`input_hash` text NOT NULL,
	`input_versions` text NOT NULL,
	`generator_version` text,
	`generated_at` integer NOT NULL,
	`output_artifact_url` text
);
--> statement-breakpoint
CREATE INDEX `idx_gen_records_input_hash` ON `generation_records` (`input_hash`);--> statement-breakpoint
CREATE TABLE `workflow_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`content_hash` text NOT NULL,
	`snapshot_data` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_snapshots_content_hash_unique` ON `workflow_snapshots` (`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_snapshot_content_hash` ON `workflow_snapshots` (`content_hash`);