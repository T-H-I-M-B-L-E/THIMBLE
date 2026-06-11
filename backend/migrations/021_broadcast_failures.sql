-- Per-recipient failure detail for broadcasts. Lets ARIA (and the admin UI)
-- answer "which recipients failed and why" instead of only an aggregate count.
CREATE TABLE IF NOT EXISTS broadcast_failures (
  id           SERIAL PRIMARY KEY,
  broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  reason       TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_failures_broadcast_id
  ON broadcast_failures (broadcast_id);
