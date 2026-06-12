package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/db"
)

// PublicStats returns only safe, non-sensitive aggregate counts for the public
// landing page. Deliberately excludes anything admin-only (emails, bans,
// revenue, per-role breakdowns, etc.).
func PublicStats(c *fiber.Ctx) error {
	var creatives, verified, posts, gigs int

	// Errors are non-fatal — a missing count just shows as 0 and the frontend
	// falls back to its qualitative label.
	_ = db.Pool.QueryRow(c.Context(), `SELECT count(*) FROM users WHERE is_banned = false`).Scan(&creatives)
	_ = db.Pool.QueryRow(c.Context(), `SELECT count(*) FROM users WHERE is_verified = true`).Scan(&verified)
	_ = db.Pool.QueryRow(c.Context(), `SELECT count(*) FROM posts`).Scan(&posts)
	_ = db.Pool.QueryRow(c.Context(), `SELECT count(*) FROM gigs`).Scan(&gigs)

	return c.JSON(fiber.Map{
		"creatives": creatives,
		"verified":  verified,
		"posts":     posts,
		"gigs":      gigs,
	})
}
