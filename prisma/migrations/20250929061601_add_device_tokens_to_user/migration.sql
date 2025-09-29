/*
  Warnings:

  - You are about to drop the column `stripe_account_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `commission_transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "commission_transactions" DROP CONSTRAINT "commission_transactions_job_id_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "stripe_account_id",
ADD COLUMN     "device_tokens" TEXT[],
ADD COLUMN     "stripe_connect_account_id" TEXT;

-- DropTable
DROP TABLE "commission_transactions";
