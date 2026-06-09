CREATE TABLE IF NOT EXISTS login_attempts (
  email        TEXT PRIMARY KEY,
  failed_count INT  NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
