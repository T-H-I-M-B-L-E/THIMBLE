CREATE TABLE IF NOT EXISTS gig_applications (
  id         BIGSERIAL PRIMARY KEY,
  gig_id     BIGINT NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gig_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gig_applications_user ON gig_applications(user_id);
