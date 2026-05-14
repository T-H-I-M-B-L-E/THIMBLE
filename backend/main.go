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

	go sweepExpiredTickets()

	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
	}))

	// Rate limiter: 10 req/min per IP on auth endpoints
	authLimiter := limiter.New(limiter.Config{
		Max:        10,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string { return c.IP() },
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "too many requests, please try again later"})
		},
	})

	// ── Auth (public) ─────────────────────────────────────────────────────────
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

	// ── WebSocket — conversation rooms ────────────────────────────────────────
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

	// ── Gigs ──────────────────────────────────────────────────────────────────
	app.Get("/api/gigs", handleListGigs)

	// ── GitHub webhook ────────────────────────────────────────────────────────
	app.Post("/webhooks/github", handleGithubWebhook)

	// ── Admin (JWT + is_admin required) ──────────────────────────────────────
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
