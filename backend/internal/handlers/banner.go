package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/db"
	"chat-app/internal/services"
)

// PublicActiveBanner returns the active banner (if any) for the current viewer.
// Auth is optional — anonymous viewers see banners targeted to "all roles" with
// VerifiedOnly = false.
func PublicActiveBanner(c *fiber.Ctx) error {
	viewerRole := ""
	viewerVerified := false

	if userID, ok := c.Locals("userId").(string); ok && userID != "" {
		db.Pool.QueryRow(c.Context(),
			`SELECT COALESCE(role, ''), COALESCE(is_verified, false) FROM users WHERE id = $1`,
			userID).Scan(&viewerRole, &viewerVerified)
	}

	b, err := services.ActiveBannerFor(c.Context(), viewerRole, viewerVerified)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if b == nil {
		return c.JSON(nil)
	}
	return c.JSON(b)
}
