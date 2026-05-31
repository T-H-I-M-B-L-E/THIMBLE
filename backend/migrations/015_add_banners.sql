-- In-app announcement banner. Only one is "active" at a time
-- (newest non-expired, non-taken-down row).
CREATE TABLE IF NOT EXISTS banners (
  id           SERIAL PRIMARY KEY,
  message      TEXT NOT NULL,
  banner_type  TEXT NOT NULL DEFAULT 'info',     -- 'info' | 'success' | 'warning' | 'critical'
  audience     TEXT NOT NULL DEFAULT 'all',      -- 'all' | 'verified' | 'role:<role>'
  expires_at   TIMESTAMPTZ,                      -- NULL = until manually dismissed
  taken_down   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active
  ON banners (created_at DESC)
  WHERE taken_down = FALSE;
