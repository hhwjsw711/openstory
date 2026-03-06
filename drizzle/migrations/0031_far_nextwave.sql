ALTER TABLE `transactions` ADD `stripe_session_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transactions_stripe_session_id` ON `transactions` (`stripe_session_id`);