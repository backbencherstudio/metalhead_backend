-- Clear existing estimated_time data and convert to decimal
UPDATE "jobs" SET "estimated_time" = NULL WHERE "estimated_time" IS NOT NULL;

-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "estimated_time" TYPE DECIMAL USING estimated_time::DECIMAL;
