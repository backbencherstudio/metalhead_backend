-- CreateEnum
CREATE TYPE "UrgencyType" AS ENUM ('FIXED', 'ANYTIME');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "urgency_type" "UrgencyType" DEFAULT 'ANYTIME';
