-- CreateTable
CREATE TABLE "job_status_histories" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "job_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "job_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_status_histories_job_id_status_idx" ON "job_status_histories"("job_id", "status");

-- AddForeignKey
ALTER TABLE "job_status_histories" ADD CONSTRAINT "job_status_histories_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
