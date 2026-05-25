package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

// BlockUser inserts a block from the caller against :id. Idempotent.
func BlockUser(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	target := c.Params("id")
	if err := services.BlockUser(c.Context(), userId, target); err != nil {
		return respondError(c, err)
	}
	return c.SendStatus(204)
}

func UnblockUser(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	target := c.Params("id")
	if err := services.UnblockUser(c.Context(), userId, target); err != nil {
		return respondError(c, err)
	}
	return c.SendStatus(204)
}

func ListBlocked(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	return c.JSON(services.ListBlocked(c.Context(), userId))
}
