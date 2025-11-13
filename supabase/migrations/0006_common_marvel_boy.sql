ALTER TABLE "sequences" ALTER COLUMN "style_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "frames" DROP COLUMN "thumbnail_retry_attempt";--> statement-breakpoint
ALTER TABLE "frames" DROP COLUMN "video_retry_attempt";--> statement-breakpoint
ALTER TABLE "sequences" DROP COLUMN "retry_attempt";