package db

import (
	"context"
	"log"
)

// EnsureSchema creates and back-fills tables that pre-date the
// migrations/ directory. New schema changes should be added as numbered
// migration files instead.
func EnsureSchema(ctx context.Context) {
	Pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`)
	Pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS total_logins INT NOT NULL DEFAULT 0`)

	mustExec(ctx, `
		CREATE TABLE IF NOT EXISTS messages (
			id        BIGSERIAL PRIMARY KEY,
			user_id   TEXT NOT NULL,
			name      TEXT NOT NULL,
			content   TEXT NOT NULL,
			timestamp BIGINT NOT NULL
		)
	`, "messages")

	mustExec(ctx, `
		CREATE TABLE IF NOT EXISTS posts (
			id            BIGSERIAL PRIMARY KEY,
			user_id       TEXT NOT NULL,
			author_name   TEXT NOT NULL,
			author_avatar TEXT NOT NULL DEFAULT '',
			image_url     TEXT NOT NULL DEFAULT '',
			description   TEXT NOT NULL DEFAULT '',
			likes         INT NOT NULL DEFAULT 0,
			comments      INT NOT NULL DEFAULT 0,
			tagged_users  JSONB NOT NULL DEFAULT '[]',
			created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`, "posts")
	Pool.Exec(ctx, `ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments INT NOT NULL DEFAULT 0`)
	// Multi-image support. images[0] mirrors image_url so older code paths
	// that read image_url keep working.
	Pool.Exec(ctx, `ALTER TABLE posts ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'`)

	mustExec(ctx, `
		CREATE TABLE IF NOT EXISTS post_likes (
			id         BIGSERIAL PRIMARY KEY,
			post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			user_id    TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(post_id, user_id)
		)
	`, "post_likes")

	mustExec(ctx, `
		CREATE TABLE IF NOT EXISTS post_comments (
			id          BIGSERIAL PRIMARY KEY,
			post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			user_id     TEXT NOT NULL,
			user_name   TEXT NOT NULL DEFAULT '',
			user_avatar TEXT NOT NULL DEFAULT '',
			content     TEXT NOT NULL,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`, "post_comments")

	mustExec(ctx, `
		CREATE TABLE IF NOT EXISTS gigs (
			id               BIGSERIAL PRIMARY KEY,
			title            TEXT NOT NULL,
			description      TEXT NOT NULL DEFAULT '',
			location         TEXT NOT NULL DEFAULT '',
			payment          TEXT NOT NULL DEFAULT '',
			posted_by        TEXT NOT NULL,
			posted_by_role   TEXT NOT NULL DEFAULT '',
			posted_by_avatar TEXT NOT NULL DEFAULT '',
			applications     INT NOT NULL DEFAULT 0,
			created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`, "gigs")

	mustExec(ctx, `
		CREATE TABLE IF NOT EXISTS admin_audit_log (
			id          BIGSERIAL PRIMARY KEY,
			admin_id    TEXT NOT NULL,
			action      TEXT NOT NULL,
			target_id   TEXT NOT NULL DEFAULT '',
			target_name TEXT NOT NULL DEFAULT '',
			details     TEXT NOT NULL DEFAULT '',
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`, "admin_audit_log")

	mustExec(ctx, `
		CREATE TABLE IF NOT EXISTS settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`, "settings")
	Pool.Exec(ctx, `
		INSERT INTO settings (key, value) VALUES ('commit_emails_enabled', 'true')
		ON CONFLICT (key) DO NOTHING
	`)

	mustExec(ctx, `
		CREATE TABLE IF NOT EXISTS email_log (
			id         BIGSERIAL PRIMARY KEY,
			type       TEXT NOT NULL,
			recipients INT NOT NULL DEFAULT 1,
			sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`, "email_log")

	Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS conversations (
			id         BIGSERIAL PRIMARY KEY,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS conversation_participants (
			id              BIGSERIAL PRIMARY KEY,
			conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
			user_id         TEXT NOT NULL,
			user_name       TEXT NOT NULL DEFAULT '',
			user_avatar     TEXT NOT NULL DEFAULT '',
			joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(conversation_id, user_id)
		)
	`)
	// "Delete chat for me" — hide the conversation from this participant's
	// inbox without touching the other side. When the conversation receives
	// new messages, the flag is cleared so the chat resurfaces.
	Pool.Exec(ctx, `ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ`)

	// User-to-user blocks. blocker_id chose to mute and hide blocked_id.
	// Effects ripple through feed/profile/follows/messages/suggestions.
	Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS blocks (
			blocker_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			blocked_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (blocker_id, blocked_id)
		)
	`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id)`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id)`)
	Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS admin_chat_messages (
			id         BIGSERIAL PRIMARY KEY,
			user_id    TEXT NOT NULL,
			user_name  TEXT NOT NULL DEFAULT '',
			content    TEXT NOT NULL,
			timestamp  BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)

	Pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_prefs JSONB NOT NULL DEFAULT '{"likes":true,"comments":true,"follows":true,"product_updates":true}'::jsonb`)

	Pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram TEXT NOT NULL DEFAULT ''`)

	Pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0`)

	mustExec(ctx, `
		CREATE TABLE IF NOT EXISTS gig_applications (
			id         BIGSERIAL PRIMARY KEY,
			gig_id     BIGINT NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
			user_id    TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (gig_id, user_id)
		)
	`, "gig_applications")
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_gig_applications_user ON gig_applications(user_id)`)

	Pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE`)
	Pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ`)
	Pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_message TEXT NOT NULL DEFAULT ''`)

	Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS conversation_messages (
			id              BIGSERIAL PRIMARY KEY,
			conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
			user_id         TEXT NOT NULL,
			name            TEXT NOT NULL DEFAULT '',
			content         TEXT NOT NULL,
			timestamp       BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	// Soft-delete column: when set, the message is hidden from THAT user's
	// view but still visible to the other participant. WhatsApp-style
	// "delete for me".
	Pool.Exec(ctx, `ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS deleted_by_user_id TEXT`)
	// Delivery + read receipts. delivered_at is stamped server-side when a
	// recipient connection receives the message; read_at when the recipient
	// reports the conversation visible.
	Pool.Exec(ctx, `ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`)
	Pool.Exec(ctx, `ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ`)

	Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS notifications (
			id         BIGSERIAL PRIMARY KEY,
			user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			type       TEXT NOT NULL CHECK (type IN ('LIKE', 'TAG', 'FOLLOW')),
			post_id    BIGINT REFERENCES posts(id) ON DELETE CASCADE,
			read       BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`)

	Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS post_saves (
			id         BIGSERIAL PRIMARY KEY,
			post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			user_id    TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(post_id, user_id)
		)
	`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_post_saves_user_id ON post_saves(user_id)`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_post_saves_post_id ON post_saves(post_id)`)

	// Hot-path indexes for foreign-key lookups
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id)`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id)`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id)`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id)`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id)`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation_id ON conversation_messages(conversation_id)`)
	Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_conv_participants_user_id ON conversation_participants(user_id)`)
}

func mustExec(ctx context.Context, sql, table string) {
	if _, err := Pool.Exec(ctx, sql); err != nil {
		log.Fatalf("Failed to create %s table: %v", table, err)
	}
}
