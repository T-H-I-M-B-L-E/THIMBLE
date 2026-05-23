package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/websocket/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	jwtSecret = os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	resendKey = os.Getenv("RESEND_API_KEY")
	if resendKey == "" {
		log.Fatal("RESEND_API_KEY environment variable is required")
	}

	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		connStr = "postgresql://localhost:5432/thimble_chat"
	}

	allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:3000,https://tvimble.tech,https://admin.tvimble.com,https://admin.tvimble.tech"
	}

	var err error
	dbPool, err = pgxpool.New(context.Background(), connStr)
	if err != nil {
		log.Fatal("Unable to connect to database:", err)
	}
	defer dbPool.Close()

	runMigrations(context.Background())

	dbPool.Exec(context.Background(), `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`)
	dbPool.Exec(context.Background(), `ALTER TABLE users ADD COLUMN IF NOT EXISTS total_logins INT NOT NULL DEFAULT 0`)

	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS messages (
			id        BIGSERIAL PRIMARY KEY,
			user_id   TEXT NOT NULL,
			name      TEXT NOT NULL,
			content   TEXT NOT NULL,
			timestamp BIGINT NOT NULL
		)
	`)
	if err != nil {
		log.Fatal("Failed to create messages table:", err)
	}

	_, err = dbPool.Exec(context.Background(), `
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
	`)
	if err != nil {
		log.Fatal("Failed to create posts table:", err)
	}
	dbPool.Exec(context.Background(), `ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments INT NOT NULL DEFAULT 0`)

	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS post_likes (
			id         BIGSERIAL PRIMARY KEY,
			post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			user_id    TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(post_id, user_id)
		)
	`)
	if err != nil {
		log.Fatal("Failed to create post_likes table:", err)
	}

	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS post_comments (
			id          BIGSERIAL PRIMARY KEY,
			post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			user_id     TEXT NOT NULL,
			user_name   TEXT NOT NULL DEFAULT '',
			user_avatar TEXT NOT NULL DEFAULT '',
			content     TEXT NOT NULL,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatal("Failed to create post_comments table:", err)
	}

	_, err = dbPool.Exec(context.Background(), `
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
	`)
	if err != nil {
		log.Fatal("Failed to create gigs table:", err)
	}

	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS admin_audit_log (
			id          BIGSERIAL PRIMARY KEY,
			admin_id    TEXT NOT NULL,
			action      TEXT NOT NULL,
			target_id   TEXT NOT NULL DEFAULT '',
			target_name TEXT NOT NULL DEFAULT '',
			details     TEXT NOT NULL DEFAULT '',
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatal("Failed to create admin_audit_log table:", err)
	}

	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`)
	if err != nil {
		log.Fatal("Failed to create settings table:", err)
	}
	dbPool.Exec(context.Background(), `
		INSERT INTO settings (key, value) VALUES ('commit_emails_enabled', 'true')
		ON CONFLICT (key) DO NOTHING
	`)

	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS email_log (
			id         BIGSERIAL PRIMARY KEY,
			type       TEXT NOT NULL,
			recipients INT NOT NULL DEFAULT 1,
			sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatal("Failed to create email_log table:", err)
	}

	dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS conversations (
			id         BIGSERIAL PRIMARY KEY,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	dbPool.Exec(context.Background(), `
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
	dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS admin_chat_messages (
			id         BIGSERIAL PRIMARY KEY,
			user_id    TEXT NOT NULL,
			user_name  TEXT NOT NULL DEFAULT '',
			content    TEXT NOT NULL,
			timestamp  BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)

	dbPool.Exec(context.Background(), `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE`)
	dbPool.Exec(context.Background(), `ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ`)
	dbPool.Exec(context.Background(), `ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_message TEXT NOT NULL DEFAULT ''`)

	dbPool.Exec(context.Background(), `
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

	dbPool.Exec(context.Background(), `
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
	dbPool.Exec(context.Background(), `
		CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)
	`)
	dbPool.Exec(context.Background(), `
		CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)
	`)

	// Hot-path indexes for foreign-key lookups
	dbPool.Exec(context.Background(), `CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id)`)
	dbPool.Exec(context.Background(), `CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id)`)
	dbPool.Exec(context.Background(), `CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id)`)
	dbPool.Exec(context.Background(), `CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)`)
	dbPool.Exec(context.Background(), `CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id)`)
	dbPool.Exec(context.Background(), `CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id)`)
	dbPool.Exec(context.Background(), `CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation_id ON conversation_messages(conversation_id)`)
	dbPool.Exec(context.Background(), `CREATE INDEX IF NOT EXISTS idx_conv_participants_user_id ON conversation_participants(user_id)`)

	go sweepExpiredTickets()

	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
	}))

	authLimiter := limiter.New(limiter.Config{
		Max:        10,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string { return c.IP() },
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "too many requests, please try again later"})
		},
	})

	// ── Auth ──────────────────────────────────────────────────────────────────
	app.Post("/auth/signup", authLimiter, handleSignup)
	app.Post("/auth/verify-email", authLimiter, handleVerifyEmail)
	app.Post("/auth/login", authLimiter, handleLogin)
	app.Post("/auth/logout", handleLogout)
	app.Post("/auth/forgot-password", authLimiter, handleForgotPassword)
	app.Post("/auth/reset-password", authLimiter, handleResetPassword)
	app.Post("/auth/make-admin", handleMakeAdmin)

	// ── WebSocket ticket ──────────────────────────────────────────────────────
	app.Post("/api/ws-ticket", jwtAuth, handleIssueWSTicket)

	// ── Users ─────────────────────────────────────────────────────────────────
	app.Patch("/users/:id", jwtAuth, handleUpdateUserProfile)
	app.Get("/users/:id", jwtAuth, handleGetUserProfile)
	app.Get("/api/users", jwtAuth, handleListAllUsers)
	app.Get("/api/users/suggestions", jwtAuth, handleUserSuggestions)
	app.Get("/api/tags/trending", jwtAuth, handleTrendingTags)

	// ── WebSocket ─────────────────────────────────────────────────────────────
	app.Get("/ws", wsAuth, websocket.New(handleConversationWS))

	// ── Conversations ─────────────────────────────────────────────────────────
	app.Get("/api/conversations", jwtAuth, handleListConversations)
	app.Post("/api/conversations", jwtAuth, handleCreateConversation)
	app.Get("/api/conversations/:id/messages", jwtAuth, handleGetConversationMessages)

	// ── Admin chat ────────────────────────────────────────────────────────────
	app.Get("/admin/chat/history", jwtAuth, adminAuth, handleAdminChatHistory)
	app.Get("/admin/ws", wsAdminAuth, websocket.New(handleAdminWS))

	// ── Posts ─────────────────────────────────────────────────────────────────
	app.Get("/api/posts", handleListPosts)
	app.Post("/api/posts", jwtAuth, handleCreatePost)
	app.Delete("/api/posts/:id", jwtAuth, handleDeletePost)
	app.Get("/api/posts/:id/likes", jwtAuth, handleGetPostLikes)
	app.Post("/api/posts/:id/likes", jwtAuth, handleLikePost)
	app.Delete("/api/posts/:id/likes", jwtAuth, handleUnlikePost)
	app.Get("/api/posts/:id/comments", jwtAuth, handleGetPostComments)
	app.Post("/api/posts/:id/comments", jwtAuth, handleCreatePostComment)

	// ── Follows ───────────────────────────────────────────────────────────────
	app.Get("/api/follows", jwtAuth, handleGetFollows)
	app.Post("/api/follows", jwtAuth, handleFollow)
	app.Delete("/api/follows", jwtAuth, handleUnfollow)

	// ── Notifications ─────────────────────────────────────────────────────────
	app.Get("/api/notifications", jwtAuth, handleListNotifications)
	app.Patch("/api/notifications/:id/read", jwtAuth, handleMarkNotificationAsRead)

	// ── Gigs ──────────────────────────────────────────────────────────────────
	app.Get("/api/gigs", handleListGigs)

	// ── Webhooks ──────────────────────────────────────────────────────────────
	app.Post("/webhooks/github", handleGithubWebhook)

	// ── Admin ─────────────────────────────────────────────────────────────────
	adminGroup := app.Group("/admin", jwtAuth, adminAuth)
	adminGroup.Get("/stats", handleAdminStats)
	adminGroup.Get("/users", handleAdminListUsers)
	adminGroup.Get("/users/:id", handleAdminGetUser)
	adminGroup.Patch("/users/:id", handleAdminUpdateUser)
	adminGroup.Delete("/users/:id", handleAdminDeleteUser)
	adminGroup.Post("/users/:id/ban", handleAdminBanUser)
	adminGroup.Delete("/users/:id/ban", handleAdminUnbanUser)
	adminGroup.Get("/audit-log", handleAdminAuditLog)
	adminGroup.Get("/settings", handleAdminGetSettings)
	adminGroup.Patch("/settings", handleAdminUpdateSettings)
	adminGroup.Get("/email-stats", handleAdminEmailStats)
	adminGroup.Get("/verification-requests", handleAdminListVerificationRequests)
	adminGroup.Patch("/verification-requests/:id", handleAdminReviewVerification)

	// ── Verification (user-facing) ────────────────────────────────────────────
	app.Get("/api/verification/me", jwtAuth, handleGetMyVerification)
	app.Post("/api/verification", jwtAuth, handleSubmitVerification)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
