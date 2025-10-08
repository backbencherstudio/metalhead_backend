-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "actual_hours" DECIMAL(65,30),
ADD COLUMN     "end_time" TIMESTAMP(3),
ADD COLUMN     "estimated_hours" DECIMAL(65,30),
ADD COLUMN     "hourly_rate" DECIMAL(65,30),
ADD COLUMN     "start_time" TIMESTAMP(3);
