-- Add new fields for job scheduling and time tracking
ALTER TABLE "jobs" ADD COLUMN "start_time" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN "end_time" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN "actual_start_time" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN "actual_end_time" TIMESTAMP(3);

-- Move estimated_time to be after the new fields
ALTER TABLE "jobs" ALTER COLUMN "estimated_time" TYPE TEXT;
