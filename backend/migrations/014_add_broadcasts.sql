-- Log of admin broadcasts. Lets us show send history and prevent
-- accidental double-sends.
CREATE TABLE IF NOT EXISTS broadcasts (
  id          SERIAL PRIMARY KEY,
  sent_by     TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  audience    TEXT NOT NULL,         -- 'all', 'verified', 'role:designer', etc.
  recipients  INTEGER NOT NULL DEFAULT 0,
  succeeded   INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts (created_at DESC);
