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
CREATE TABLE "job_requirements" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "status" SMALLINT DEFAULT 1,
    "title" TEXT,
    "description" TEXT,
    "job_id" TEXT,

    CONSTRAINT "job_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_notes" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "status" SMALLINT DEFAULT 1,
    "title" TEXT,
    "description" TEXT,
    "job_id" TEXT,

    CONSTRAINT "job_notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
