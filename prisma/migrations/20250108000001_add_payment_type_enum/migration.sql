-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('HOURLY', 'FIXED');

-- Update existing data to match enum values
UPDATE "jobs" SET "payment_type" = 'FIXED' WHERE "payment_type" = 'Fixed Price';
UPDATE "jobs" SET "payment_type" = 'HOURLY' WHERE "payment_type" = 'Hourly';

-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "payment_type" TYPE "PaymentType" USING "payment_type"::"PaymentType";
