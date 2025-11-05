-- Step 1: Rename old enum type
ALTER TYPE "frame_generation_status" RENAME TO "frame_generation_status_old";--> statement-breakpoint

-- Step 2: Create new enum with 'pending' instead of 'idle'
CREATE TYPE "frame_generation_status" AS ENUM('pending', 'generating', 'completed', 'failed');--> statement-breakpoint

-- Step 3: Update thumbnail_status column to use new enum, converting 'idle' to 'pending'
ALTER TABLE "frames" ALTER COLUMN "thumbnail_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "frames" ALTER COLUMN "thumbnail_status" TYPE "frame_generation_status" USING (
  CASE
    WHEN "thumbnail_status"::text = 'idle' THEN 'pending'::frame_generation_status
    ELSE "thumbnail_status"::text::frame_generation_status
  END
);--> statement-breakpoint
ALTER TABLE "frames" ALTER COLUMN "thumbnail_status" SET DEFAULT 'pending';--> statement-breakpoint

-- Step 4: Update video_status column to use new enum, converting 'idle' to 'pending'
ALTER TABLE "frames" ALTER COLUMN "video_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "frames" ALTER COLUMN "video_status" TYPE "frame_generation_status" USING (
  CASE
    WHEN "video_status"::text = 'idle' THEN 'pending'::frame_generation_status
    ELSE "video_status"::text::frame_generation_status
  END
);--> statement-breakpoint
ALTER TABLE "frames" ALTER COLUMN "video_status" SET DEFAULT 'pending';--> statement-breakpoint

-- Step 5: Drop old enum type
DROP TYPE "frame_generation_status_old";--> statement-breakpoint

-- Other unrelated schema changes
ALTER TABLE "script_analysis_audit" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "script_analysis_audit" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "styles" ALTER COLUMN "config" DROP DEFAULT;