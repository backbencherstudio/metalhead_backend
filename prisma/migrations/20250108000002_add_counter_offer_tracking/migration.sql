-- Add counter offer and helper tracking fields to jobs table
-- This migration adds the missing fields for counter offer acceptance and direct job assignment

-- Add accepted_counter_offer_id field
ALTER TABLE "jobs" ADD COLUMN "accepted_counter_offer_id" TEXT;

-- Add assigned_helper_id field  
ALTER TABLE "jobs" ADD COLUMN "assigned_helper_id" TEXT;

-- Add foreign key constraint for accepted_counter_offer_id
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_accepted_counter_offer_id_fkey" 
FOREIGN KEY ("accepted_counter_offer_id") REFERENCES "counter_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key constraint for assigned_helper_id
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assigned_helper_id_fkey" 
FOREIGN KEY ("assigned_helper_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
