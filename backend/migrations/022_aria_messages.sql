-- Persisted ARIA chat history, per admin. Lets conversations survive page
-- refreshes and gives a record of what was asked and done over time.
CREATE TABLE IF NOT EXISTS aria_messages (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,              -- 'user' | 'ai'
  content     TEXT NOT NULL DEFAULT '',
  action_json TEXT NOT NULL DEFAULT '',   -- serialized action payload, if any
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aria_messages_admin_created
  ON aria_messages (admin_id, created_at);
