-- Create the jobType enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "jobType" AS ENUM ('FIXED', 'ANYTIME');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update existing data to match enum values before changing column type
UPDATE "jobs" SET "job_type" = 'ANYTIME' WHERE "job_type" IS NULL;
UPDATE "jobs" SET "job_type" = 'FIXED' WHERE "job_type" = 'urgent';
UPDATE "jobs" SET "job_type" = 'ANYTIME' WHERE "job_type" = 'anytime';

-- Alter the job_type column to use the enum
ALTER TABLE "jobs" ALTER COLUMN "job_type" TYPE "jobType" USING "job_type"::"jobType";

-- Drop the old UrgencyType enum if it exists
DROP TYPE IF EXISTS "UrgencyType";
