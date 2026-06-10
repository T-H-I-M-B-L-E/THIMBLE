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
	"chat-app/internal/metrics"
	"chat-app/internal/middleware"
	"chat-app/internal/services"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	closeDB := db.Init(ctx, cfg.DatabaseURL)
	defer closeDB()

	db.RunMigrations(ctx)
	db.EnsureSchema(ctx)

	go middleware.SweepExpiredTickets()
	services.StartInfraMonitor(ctx)

	app := fiber.New(fiber.Config{
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
		BodyLimit:    8 * 1024 * 1024, // 8 MB
	})

	// Count responses and record errors + slow requests for the infra dashboard.
	app.Use(func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		latencyMs := time.Since(start).Milliseconds()
		s := c.Response().StatusCode()
		switch {
		case s >= 500:
			metrics.Inc5xx()
			metrics.PushError(metrics.ErrorEntry{
				Time: time.Now(), Method: c.Method(),
				Path: c.Path(), Status: s, LatencyMs: latencyMs,
			})
		case s >= 400:
			metrics.Inc4xx()
		default:
			metrics.Inc2xx()
		}
		if latencyMs >= metrics.SlowThresholdMs {
			metrics.PushSlow(metrics.SlowEntry{
				Time: time.Now(), Method: c.Method(),
				Path: c.Path(), Status: s, LatencyMs: latencyMs,
			})
		}
		// Per-route latency tracker — uses route template (e.g. /api/posts/:id)
		// not the concrete path so IDs don't fragment the bucket.
		if route := c.Route(); route != nil && route.Path != "" {
			metrics.RecordRoute(c.Method(), route.Path, latencyMs)
		}
		return err
	})

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

	apiLimiter := limiter.New(limiter.Config{
		Max:        300,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string { return c.IP() },
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "rate limit exceeded"})
		},
	})

	registerRoutes(app, authLimiter, apiLimiter)

	log.Printf("Server starting on :%s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}

// registerRoutes is kept separate from main() so the route table is the
// one thing you read to understand the public API.
func registerRoutes(app *fiber.App, authLimiter fiber.Handler, apiLimiter fiber.Handler) {
	// ── Health check ──────────────────────────────────────────────────────────
	// External uptime monitors hit this. Returns 200 only if DB is reachable.
	app.Get("/health", func(c *fiber.Ctx) error {
		if err := db.Pool.Ping(c.Context()); err != nil {
			return c.Status(503).JSON(fiber.Map{"status": "down", "db": err.Error()})
		}
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// ── Auth ──────────────────────────────────────────────────────────────────
	app.Post("/auth/signup", authLimiter, handlers.Signup)
	app.Post("/auth/verify-email", authLimiter, handlers.VerifyEmail)
	app.Post("/auth/login", authLimiter, handlers.Login)
	app.Post("/auth/logout", handlers.Logout)
	app.Post("/auth/logout-all", middleware.RequireJWT, handlers.LogoutAll)
	app.Post("/auth/forgot-password", authLimiter, handlers.ForgotPassword)
	app.Post("/auth/reset-password", authLimiter, handlers.ResetPassword)
	app.Post("/auth/change-password", middleware.RequireJWT, handlers.ChangePassword)
	app.Post("/auth/change-email", middleware.RequireJWT, handlers.ChangeEmail)
	app.Delete("/auth/account", middleware.RequireJWT, handlers.DeleteAccount)
	app.Post("/auth/make-admin", handlers.MakeAdmin)

	// ── WebSocket (no rate limit — long-lived connections) ────────────────────
	app.Get("/ws", middleware.RequireWSAuth, websocket.New(handlers.ConversationWS))
	app.Get("/admin/ws", middleware.RequireWSAdminAuth, websocket.New(handlers.AdminWS))

	// ── Webhooks (no rate limit — called by GitHub) ───────────────────────────
	app.Post("/webhooks/github", handlers.GithubWebhook)

	// ── Users (legacy non-/api paths) ─────────────────────────────────────────
	app.Patch("/users/:id", apiLimiter, middleware.RequireJWT, handlers.UpdateUserProfile)
	app.Get("/users/:id", apiLimiter, middleware.RequireJWT, handlers.GetUserProfile)

	// ── Admin chat ────────────────────────────────────────────────────────────
	app.Get("/admin/chat/history", middleware.RequireJWT, middleware.RequireAdmin, handlers.AdminChatHistory)

	// ── /api group — 300 req/min per IP ───────────────────────────────────────
	api := app.Group("/api", apiLimiter)

	api.Post("/ws-ticket", middleware.RequireJWT, middleware.IssueWSTicket)

	api.Get("/settings/email-prefs", middleware.RequireJWT, handlers.GetEmailPrefs)
	api.Patch("/settings/email-prefs", middleware.RequireJWT, handlers.UpdateEmailPrefs)

	api.Get("/users", middleware.RequireJWT, handlers.ListAllUsers)
	api.Get("/users/suggestions", middleware.RequireJWT, handlers.UserSuggestions)
	api.Get("/tags/trending", middleware.RequireJWT, handlers.TrendingTags)

	api.Get("/conversations", middleware.RequireJWT, handlers.ListConversations)
	api.Post("/conversations", middleware.RequireJWT, handlers.CreateConversation)
	api.Get("/conversations/:id/messages", middleware.RequireJWT, handlers.GetConversationMessages)
	api.Delete("/conversations/:id/messages/:msgId", middleware.RequireJWT, handlers.DeleteConversationMessage)
	api.Post("/conversations/:id/messages/:msgId/restore", middleware.RequireJWT, handlers.RestoreConversationMessage)
	api.Post("/conversations/:id/read", middleware.RequireJWT, handlers.MarkConversationRead)
	api.Delete("/conversations/:id", middleware.RequireJWT, handlers.DeleteConversation)
	api.Post("/conversations/:id/call", middleware.RequireJWT, handlers.CreateCall)
	api.Post("/conversations/:id/call/join", middleware.RequireJWT, handlers.JoinCall)
	api.Delete("/conversations/:id/call", middleware.RequireJWT, handlers.EndCall)

	api.Get("/blocks", middleware.RequireJWT, handlers.ListBlocked)
	api.Post("/blocks/:id", middleware.RequireJWT, handlers.BlockUser)
	api.Delete("/blocks/:id", middleware.RequireJWT, handlers.UnblockUser)

	api.Get("/posts", handlers.ListPosts)
	api.Post("/posts", middleware.RequireJWT, handlers.CreatePost)
	api.Get("/posts/saved", middleware.RequireJWT, handlers.GetSavedPosts)
	api.Get("/posts/slug/:slug", handlers.GetPostBySlug)
	api.Get("/posts/:id", handlers.GetPost)
	api.Delete("/posts/:id", middleware.RequireJWT, handlers.DeletePost)
	api.Get("/posts/:id/likes", middleware.RequireJWT, handlers.GetPostLikes)
	api.Post("/posts/:id/likes", middleware.RequireJWT, handlers.LikePost)
	api.Delete("/posts/:id/likes", middleware.RequireJWT, handlers.UnlikePost)
	api.Get("/posts/:id/comments", middleware.RequireJWT, handlers.GetPostComments)
	api.Post("/posts/:id/comments", middleware.RequireJWT, handlers.CreatePostComment)
	api.Delete("/posts/:id/comments/:commentId", middleware.RequireJWT, handlers.DeletePostComment)
	api.Post("/posts/:id/saves", middleware.RequireJWT, handlers.SavePost)
	api.Delete("/posts/:id/saves", middleware.RequireJWT, handlers.UnsavePost)

	api.Get("/follows", middleware.RequireJWT, handlers.GetFollows)
	api.Post("/follows", middleware.RequireJWT, handlers.Follow)
	api.Delete("/follows", middleware.RequireJWT, handlers.Unfollow)

	api.Get("/notifications", middleware.RequireJWT, handlers.ListNotifications)
	api.Patch("/notifications/:id/read", middleware.RequireJWT, handlers.MarkNotificationRead)

	api.Get("/gigs", middleware.OptionalJWT, handlers.ListGigs)
	api.Post("/gigs", middleware.RequireJWT, handlers.CreateGig)
	api.Post("/gigs/:id/apply", middleware.RequireJWT, handlers.ApplyToGig)
	api.Patch("/gigs/:id/close", middleware.RequireJWT, handlers.CloseGig)
	api.Delete("/gigs/:id", middleware.RequireJWT, handlers.DeleteGig)
	api.Get("/gigs/:id/applicants", middleware.RequireJWT, handlers.GigApplicants)
	api.Patch("/gigs/:id/applicants/status", middleware.RequireJWT, handlers.UpdateApplicantStatus)

	api.Post("/ads/:id/click", handlers.RecordAdClick)
	api.Post("/ads/:id/impression", middleware.OptionalJWT, handlers.RecordAdImpression)

	api.Get("/verification/me", middleware.RequireJWT, handlers.GetMyVerification)
	api.Post("/verification", middleware.RequireJWT, handlers.SubmitVerification)

	api.Get("/banner", middleware.OptionalJWT, handlers.PublicActiveBanner)

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
	adminGroup.Get("/infra", handlers.AdminInfra)
	adminGroup.Post("/infra/test-alert", handlers.AdminTestAlert)
	adminGroup.Post("/aria/email", handlers.AdminARIAEmail)
	adminGroup.Get("/broadcast/preview", handlers.AdminBroadcastPreview)
	adminGroup.Get("/broadcast/history", handlers.AdminBroadcastHistory)
	adminGroup.Post("/broadcast", handlers.AdminBroadcast)
	adminGroup.Get("/banner/current", handlers.AdminBannerCurrent)
	adminGroup.Post("/banner/take-down", handlers.AdminBannerTakeDown)
	adminGroup.Post("/ads", handlers.CreateAd)
	adminGroup.Get("/ads", handlers.ListAds)
	adminGroup.Get("/ads/:id", handlers.GetAd)
	adminGroup.Patch("/ads/:id", handlers.UpdateAd)
	adminGroup.Delete("/ads/:id", handlers.DeleteAd)
	adminGroup.Patch("/ads/:id/toggle", handlers.ToggleAd)
}
