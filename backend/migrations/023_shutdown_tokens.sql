CREATE TABLE IF NOT EXISTS shutdown_tokens (
  id        BIGSERIAL PRIMARY KEY,
  admin_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token     TEXT NOT NULL UNIQUE,
  used      BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shutdown_tokens_token_idx ON shutdown_tokens(token) WHERE used = false;
