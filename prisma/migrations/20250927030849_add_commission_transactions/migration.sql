-- CreateTable
CREATE TABLE "commission_transactions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "job_id" TEXT NOT NULL,
    "payment_intent_id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "total_amount" DECIMAL(65,30) NOT NULL,
    "platform_commission" DECIMAL(65,30) NOT NULL,
    "helper_amount" DECIMAL(65,30) NOT NULL,
    "commission_percent" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "commission_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
