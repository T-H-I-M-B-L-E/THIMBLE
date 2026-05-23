-- Fix bug from migration 005: it set is_verified = TRUE for every user with
-- verification_status = 'verified', which (after splitting the columns) means
-- it gave the gold badge to every account-verified user. The badge should
-- only belong to users who have an APPROVED verification_request.
--
-- This migration resets the badge to FALSE for anyone who doesn't have an
-- approved verification request on file.

UPDATE users
SET is_verified = FALSE
WHERE is_verified = TRUE
  AND id NOT IN (
    SELECT user_id FROM verification_requests WHERE status = 'approved'
  );
