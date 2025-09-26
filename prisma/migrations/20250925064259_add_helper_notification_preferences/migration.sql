/*
  Warnings:

  - You are about to drop the column `urgent_note` on the `jobs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "urgent_note";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "max_distance_km" INTEGER DEFAULT 50,
ADD COLUMN     "max_job_price" DECIMAL(65,30),
ADD COLUMN     "min_job_price" DECIMAL(65,30),
ADD COLUMN     "notification_preferences" JSONB,
ADD COLUMN     "preferred_categories" TEXT[];
