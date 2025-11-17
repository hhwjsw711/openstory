ALTER TABLE "frames" ALTER COLUMN "metadata" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "video_path" text;