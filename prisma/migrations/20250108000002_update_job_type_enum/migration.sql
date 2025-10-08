-- Drop the old UrgencyType enum
DROP TYPE IF EXISTS "UrgencyType";

-- Create the new jobType enum
CREATE TYPE "jobType" AS ENUM ('FIXED', 'ANYTIME');

-- Add the new job_type column
ALTER TABLE "jobs" ADD COLUMN "job_type" "jobType" DEFAULT 'ANYTIME';

-- Drop the old urgency_type column
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "urgency_type";
