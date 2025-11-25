-- Add status column to user table
ALTER TABLE `user` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint

-- Backfill existing users to active status
UPDATE `user` SET `status` = 'active' WHERE `status` = 'pending';
