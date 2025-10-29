ALTER TABLE "frames" ADD COLUMN "thumbnail_retry_attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "video_retry_attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sequences" ADD COLUMN "retry_attempt" integer DEFAULT 0 NOT NULL;