-- Remove redundant AcceptedOffer model and related fields
-- This migration removes the unnecessary AcceptedOffer table and relations
-- The functionality is now handled directly through Job model fields

-- Drop the accepted_offers table (if it exists)
DROP TABLE IF EXISTS "accepted_offers";

-- Note: The accepted_counter_offer_id and assigned_helper_id fields in jobs table
-- provide the same functionality more efficiently without the need for a separate table
