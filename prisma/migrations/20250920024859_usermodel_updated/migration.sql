-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripe_account_id" TEXT,
ADD COLUMN     "stripe_account_status" TEXT,
ADD COLUMN     "stripe_payouts_enabled" BOOLEAN DEFAULT false;
