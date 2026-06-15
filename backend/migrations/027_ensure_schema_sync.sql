-- Sync everything that lived only in EnsureSchema into the migrations system.
-- All statements are idempotent (IF NOT EXISTS / IF NOT EXISTS column).

-- users columns added ad-hoc in EnsureSchema
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at   TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_logins    INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_prefs     JSONB NOT NULL DEFAULT '{"likes":true,"comments":true,"follows":true,"product_updates":true}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until    TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_message     TEXT NOT NULL DEFAULT '';

-- posts columns
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments INT NOT NULL DEFAULT 0;

-- conversation_participants
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

-- conversation_messages soft-delete + receipts
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS deleted_by_user_id TEXT;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS delivered_at       TIMESTAMPTZ;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS read_at            TIMESTAMPTZ;

-- tables that only existed in EnsureSchema
CREATE TABLE IF NOT EXISTS messages (
    id        BIGSERIAL PRIMARY KEY,
    user_id   TEXT NOT NULL,
    name      TEXT NOT NULL,
    content   TEXT NOT NULL,
    timestamp BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocks (
    blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

CREATE TABLE IF NOT EXISTS admin_chat_messages (
    id         BIGSERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL,
    user_name  TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL,
    timestamp  BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- indexes that were only in EnsureSchema
CREATE INDEX IF NOT EXISTS idx_post_saves_post_id          ON post_saves(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id       ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_id   ON conversation_participants(user_id);

-- default settings row
INSERT INTO settings (key, value) VALUES ('commit_emails_enabled', 'true') ON CONFLICT (key) DO NOTHING;
