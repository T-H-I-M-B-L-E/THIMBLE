package handlers

import (
	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

func ListGigs(c *fiber.Ctx) error {
	gigs, err := services.ListGigs(c.Context())
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(gigs)
}
