-- Initial schema: all tables that exist at launch

CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    role                TEXT NOT NULL DEFAULT '',
    avatar_url          TEXT,
    bio                 TEXT,
    location            TEXT,
    website             TEXT,
    verification_status TEXT NOT NULL DEFAULT 'unverified',
    followers           INT  NOT NULL DEFAULT 0,
    following           INT  NOT NULL DEFAULT 0,
    posts               INT  NOT NULL DEFAULT 0,
    is_admin            BOOLEAN NOT NULL DEFAULT FALSE,
    is_banned           BOOLEAN NOT NULL DEFAULT FALSE,
    banned_until        TIMESTAMPTZ,
    ban_message         TEXT NOT NULL DEFAULT '',
    last_login_at       TIMESTAMPTZ,
    total_logins        INT  NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_signups (
    email         TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verification_codes (
    id         BIGSERIAL PRIMARY KEY,
    email      TEXT NOT NULL,
    code       TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
    id         BIGSERIAL PRIMARY KEY,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    user_name       TEXT NOT NULL DEFAULT '',
    user_avatar     TEXT NOT NULL DEFAULT '',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    content         TEXT NOT NULL,
    timestamp       BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
    id            BIGSERIAL PRIMARY KEY,
    user_id       TEXT NOT NULL,
    author_name   TEXT NOT NULL,
    author_avatar TEXT NOT NULL DEFAULT '',
    image_url     TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    likes         INT  NOT NULL DEFAULT 0,
    tagged_users  JSONB NOT NULL DEFAULT '[]',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_likes (
    id         BIGSERIAL PRIMARY KEY,
    post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
    id          BIGSERIAL PRIMARY KEY,
    post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL,
    user_name   TEXT NOT NULL DEFAULT '',
    user_avatar TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gigs (
    id               BIGSERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    location         TEXT NOT NULL DEFAULT '',
    payment          TEXT NOT NULL DEFAULT '',
    posted_by        TEXT NOT NULL,
    posted_by_role   TEXT NOT NULL DEFAULT '',
    posted_by_avatar TEXT NOT NULL DEFAULT '',
    applications     INT  NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follows (
    id           BIGSERIAL PRIMARY KEY,
    follower_id  TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id        BIGSERIAL PRIMARY KEY,
    user_id   TEXT NOT NULL,
    name      TEXT NOT NULL,
    content   TEXT NOT NULL,
    timestamp BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          BIGSERIAL PRIMARY KEY,
    admin_id    TEXT NOT NULL,
    action      TEXT NOT NULL,
    target_id   TEXT NOT NULL DEFAULT '',
    target_name TEXT NOT NULL DEFAULT '',
    details     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_chat_messages (
    id         BIGSERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL,
    user_name  TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL,
    timestamp  BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES ('commit_emails_enabled', 'true') ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS email_log (
    id         BIGSERIAL PRIMARY KEY,
    type       TEXT NOT NULL,
    recipients INT  NOT NULL DEFAULT 1,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
