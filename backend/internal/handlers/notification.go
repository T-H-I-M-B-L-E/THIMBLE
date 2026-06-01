package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

func ListNotifications(c *fiber.Ctx) error {
	userID, ok := c.Locals("userId").(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	notifications, err := services.ListNotifications(c.Context(), userID)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(notifications)
}

func MarkNotificationRead(c *fiber.Ctx) error {
	if err := services.MarkNotificationRead(c.Context(), c.Params("id")); err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}
