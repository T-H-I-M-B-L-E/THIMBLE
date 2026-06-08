-- Add a status field to gig_applications so posters can track applicants.
-- Values: pending (default) | shortlisted | hired | rejected
ALTER TABLE gig_applications
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'shortlisted', 'hired', 'rejected'));
