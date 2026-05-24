package main

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/websocket/v2"

	"chat-app/internal/config"
	"chat-app/internal/db"
	"chat-app/internal/handlers"
	"chat-app/internal/middleware"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	closeDB := db.Init(ctx, cfg.DatabaseURL)
	defer closeDB()

	db.RunMigrations(ctx)
	db.EnsureSchema(ctx)

	go middleware.SweepExpiredTickets()

	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
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

	registerRoutes(app, authLimiter)

	log.Printf("Server starting on :%s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}

// registerRoutes is kept separate from main() so the route table is the
// one thing you read to understand the public API.
func registerRoutes(app *fiber.App, authLimiter fiber.Handler) {
	// ── Auth ──────────────────────────────────────────────────────────────────
	app.Post("/auth/signup", authLimiter, handlers.Signup)
	app.Post("/auth/verify-email", authLimiter, handlers.VerifyEmail)
	app.Post("/auth/login", authLimiter, handlers.Login)
	app.Post("/auth/logout", handlers.Logout)
	app.Post("/auth/forgot-password", authLimiter, handlers.ForgotPassword)
	app.Post("/auth/reset-password", authLimiter, handlers.ResetPassword)
	app.Post("/auth/make-admin", handlers.MakeAdmin)

	// ── WebSocket ticket ──────────────────────────────────────────────────────
	app.Post("/api/ws-ticket", middleware.RequireJWT, middleware.IssueWSTicket)

	// ── Users ─────────────────────────────────────────────────────────────────
	app.Patch("/users/:id", middleware.RequireJWT, handlers.UpdateUserProfile)
	app.Get("/users/:id", middleware.RequireJWT, handlers.GetUserProfile)
	app.Get("/api/users", middleware.RequireJWT, handlers.ListAllUsers)
	app.Get("/api/users/suggestions", middleware.RequireJWT, handlers.UserSuggestions)
	app.Get("/api/tags/trending", middleware.RequireJWT, handlers.TrendingTags)

	// ── WebSocket ─────────────────────────────────────────────────────────────
	app.Get("/ws", middleware.RequireWSAuth, websocket.New(handlers.ConversationWS))

	// ── Conversations ─────────────────────────────────────────────────────────
	app.Get("/api/conversations", middleware.RequireJWT, handlers.ListConversations)
	app.Post("/api/conversations", middleware.RequireJWT, handlers.CreateConversation)
	app.Get("/api/conversations/:id/messages", middleware.RequireJWT, handlers.GetConversationMessages)

	// ── Admin chat ────────────────────────────────────────────────────────────
	app.Get("/admin/chat/history", middleware.RequireJWT, middleware.RequireAdmin, handlers.AdminChatHistory)
	app.Get("/admin/ws", middleware.RequireWSAdminAuth, websocket.New(handlers.AdminWS))

	// ── Posts ─────────────────────────────────────────────────────────────────
	app.Get("/api/posts", handlers.ListPosts)
	app.Post("/api/posts", middleware.RequireJWT, handlers.CreatePost)
	app.Get("/api/posts/saved", middleware.RequireJWT, handlers.GetSavedPosts)
	app.Get("/api/posts/:id", handlers.GetPost)
	app.Delete("/api/posts/:id", middleware.RequireJWT, handlers.DeletePost)
	app.Get("/api/posts/:id/likes", middleware.RequireJWT, handlers.GetPostLikes)
	app.Post("/api/posts/:id/likes", middleware.RequireJWT, handlers.LikePost)
	app.Delete("/api/posts/:id/likes", middleware.RequireJWT, handlers.UnlikePost)
	app.Get("/api/posts/:id/comments", middleware.RequireJWT, handlers.GetPostComments)
	app.Post("/api/posts/:id/comments", middleware.RequireJWT, handlers.CreatePostComment)
	app.Delete("/api/posts/:id/comments/:commentId", middleware.RequireJWT, handlers.DeletePostComment)
	app.Post("/api/posts/:id/saves", middleware.RequireJWT, handlers.SavePost)
	app.Delete("/api/posts/:id/saves", middleware.RequireJWT, handlers.UnsavePost)

	// ── Follows ───────────────────────────────────────────────────────────────
	app.Get("/api/follows", middleware.RequireJWT, handlers.GetFollows)
	app.Post("/api/follows", middleware.RequireJWT, handlers.Follow)
	app.Delete("/api/follows", middleware.RequireJWT, handlers.Unfollow)

	// ── Notifications ─────────────────────────────────────────────────────────
	app.Get("/api/notifications", middleware.RequireJWT, handlers.ListNotifications)
	app.Patch("/api/notifications/:id/read", middleware.RequireJWT, handlers.MarkNotificationRead)

	// ── Gigs ──────────────────────────────────────────────────────────────────
	app.Get("/api/gigs", handlers.ListGigs)

	// ── Webhooks ──────────────────────────────────────────────────────────────
	app.Post("/webhooks/github", handlers.GithubWebhook)

	// ── Admin ─────────────────────────────────────────────────────────────────
	adminGroup := app.Group("/admin", middleware.RequireJWT, middleware.RequireAdmin)
	adminGroup.Get("/stats", handlers.AdminStats)
	adminGroup.Get("/users", handlers.AdminListUsers)
	adminGroup.Get("/users/:id", handlers.AdminGetUser)
	adminGroup.Patch("/users/:id", handlers.AdminUpdateUser)
	adminGroup.Delete("/users/:id", handlers.AdminDeleteUser)
	adminGroup.Post("/users/:id/ban", handlers.AdminBanUser)
	adminGroup.Delete("/users/:id/ban", handlers.AdminUnbanUser)
	adminGroup.Get("/audit-log", handlers.AdminAuditLog)
	adminGroup.Get("/settings", handlers.AdminGetSettings)
	adminGroup.Patch("/settings", handlers.AdminUpdateSettings)
	adminGroup.Get("/email-stats", handlers.AdminEmailStats)
	adminGroup.Get("/verification-requests", handlers.AdminListVerificationRequests)
	adminGroup.Patch("/verification-requests/:id", handlers.AdminReviewVerification)

	// ── Verification (user-facing) ────────────────────────────────────────────
	app.Get("/api/verification/me", middleware.RequireJWT, handlers.GetMyVerification)
	app.Post("/api/verification", middleware.RequireJWT, handlers.SubmitVerification)
}
