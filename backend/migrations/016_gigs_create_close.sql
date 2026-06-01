-- Extend gigs table so posters can manage their listings.
ALTER TABLE gigs
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS role_wanted  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS poster_id    TEXT NOT NULL DEFAULT '';

-- Backfill poster_id from posted_by for existing rows
UPDATE gigs SET poster_id = posted_by WHERE poster_id = '';

-- Store applicant name + avatar so the poster can see them without
-- joining users on every request.
ALTER TABLE gig_applications
  ADD COLUMN IF NOT EXISTS applicant_name   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS applicant_avatar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS applicant_role   TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_gigs_poster ON gigs(poster_id);
CREATE INDEX IF NOT EXISTS idx_gigs_status  ON gigs(status);
