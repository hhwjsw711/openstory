-- Migration: Drop jobs table
-- Description: Remove jobs table and related indexes as we've migrated to QStash Workflow
-- Date: 2025-10-21

-- Drop foreign key constraint from fal_requests first
ALTER TABLE fal_requests DROP CONSTRAINT IF EXISTS fal_requests_job_id_fkey;

-- Drop indexes on jobs table
DROP INDEX IF EXISTS idx_jobs_team_id;
DROP INDEX IF EXISTS idx_jobs_user_id;
DROP INDEX IF EXISTS idx_jobs_status;
DROP INDEX IF EXISTS idx_jobs_type;
DROP INDEX IF EXISTS idx_jobs_created_at;

-- Drop the jobs table
DROP TABLE IF EXISTS jobs;
