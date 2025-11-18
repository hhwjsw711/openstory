ALTER TABLE `frames` ADD `image_model` text(100) DEFAULT 'nano_banana' NOT NULL;--> statement-breakpoint
ALTER TABLE `frames` ADD `image_prompt` text;