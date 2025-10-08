-- Create jobType enum
CREATE TYPE "jobType" AS ENUM ('FIXED', 'ANYTIME');

-- Update existing data
UPDATE "jobs" SET "job_type" = 'ANYTIME' WHERE "job_type" IS NULL;
UPDATE "jobs" SET "job_type" = 'FIXED' WHERE "job_type" = 'urgent';
UPDATE "jobs" SET "job_type" = 'ANYTIME' WHERE "job_type" = 'anytime';

-- Alter column to use enum
ALTER TABLE "jobs" ALTER COLUMN "job_type" TYPE "jobType" USING "job_type"::"jobType";
