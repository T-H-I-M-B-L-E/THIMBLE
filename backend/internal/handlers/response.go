package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

// respondError translates a *services.ServiceError into the historical
// fiber response shape: {"error": <human-readable message>}.
//
// A few endpoints (username conflicts, bans) return a code-driven shape
// with extra fields; handlers build those responses inline because the
// payload differs per error code and a generic mapper would obscure that.
func respondError(c *fiber.Ctx, err *services.ServiceError) error {
	if err == nil {
		return c.Status(500).JSON(fiber.Map{"error": "internal error"})
	}
	msg := err.Message
	if msg == "" {
		msg = err.Code
	}
	return c.Status(err.Status).JSON(fiber.Map{"error": msg})
}
