DO $$ BEGIN
 CREATE TYPE "public"."frame_generation_status" AS ENUM('idle', 'generating', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "thumbnail_status" "frame_generation_status" DEFAULT 'idle';--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "thumbnail_workflow_run_id" text;--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "thumbnail_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "thumbnail_error" text;--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "video_status" "frame_generation_status" DEFAULT 'idle';--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "video_workflow_run_id" text;--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "video_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "video_error" text;