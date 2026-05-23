package middleware

import (
	"context"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/db"
)

// RequireAdmin must run after RequireJWT — it reads c.Locals("userId")
// and checks the users.is_admin flag. 401 if no userId, 403 if not admin.
func RequireAdmin(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	var isAdmin bool
	err := db.Pool.QueryRow(context.Background(),
		"SELECT is_admin FROM users WHERE id = $1", userId).Scan(&isAdmin)
	if err != nil || !isAdmin {
		return c.Status(403).JSON(fiber.Map{"error": "forbidden: admin access required"})
	}
	return c.Next()
}
