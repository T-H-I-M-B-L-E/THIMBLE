package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

func ListNotifications(c *fiber.Ctx) error {
	notifications, err := services.ListNotifications(c.Context(), c.Query("userId"))
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
