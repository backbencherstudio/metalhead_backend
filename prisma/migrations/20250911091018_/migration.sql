/*
  Warnings:

  - You are about to drop the `CounterOffer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Job` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CounterOffer" DROP CONSTRAINT "CounterOffer_helper_id_fkey";

-- DropForeignKey
ALTER TABLE "CounterOffer" DROP CONSTRAINT "CounterOffer_job_id_fkey";

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_accepted_counter_offer_id_fkey";

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_helper_id_fkey";

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_user_id_fkey";

-- DropForeignKey
ALTER TABLE "job_notes" DROP CONSTRAINT "job_notes_job_id_fkey";

-- DropForeignKey
ALTER TABLE "job_requirements" DROP CONSTRAINT "job_requirements_job_id_fkey";

-- DropTable
DROP TABLE "CounterOffer";

-- DropTable
DROP TABLE "Job";

-- DropEnum
DROP TYPE "CounterOfferStatus";

-- DropEnum
DROP TYPE "JobStage";

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "status" SMALLINT DEFAULT 1,
    "title" TEXT,
    "category" TEXT,
    "date_and_time" TIMESTAMP(3),
    "price" DECIMAL(65,30),
    "payment_type" TEXT,
    "job_type" TEXT,
    "location" TEXT,
    "estimated_time" TEXT,
    "description" TEXT,
    "photos" TEXT,
    "user_id" TEXT,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_offers" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(65,30) NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "job_id" TEXT NOT NULL,
    "helper_id" TEXT NOT NULL,

    CONSTRAINT "counter_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accepted_offers" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counter_offer_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "accepted_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accepted_offers_counter_offer_id_key" ON "accepted_offers"("counter_offer_id");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_offers" ADD CONSTRAINT "counter_offers_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_offers" ADD CONSTRAINT "counter_offers_helper_id_fkey" FOREIGN KEY ("helper_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accepted_offers" ADD CONSTRAINT "accepted_offers_counter_offer_id_fkey" FOREIGN KEY ("counter_offer_id") REFERENCES "counter_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accepted_offers" ADD CONSTRAINT "accepted_offers_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accepted_offers" ADD CONSTRAINT "accepted_offers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
