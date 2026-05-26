package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/services"
)

func ListGigs(c *fiber.Ctx) error {
	callerID, _ := c.Locals("userId").(string)
	gigs, err := services.ListGigs(c.Context(), callerID)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(gigs)
}

// ApplyToGig records the caller's application for :id. Idempotent —
// returning {"already": true} on a duplicate apply instead of erroring.
func ApplyToGig(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	gigID, perr := strconv.Atoi(c.Params("id"))
	if perr != nil || gigID <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "invalid gig id"})
	}
	already, err := services.ApplyToGig(c.Context(), gigID, userId)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "already": already})
}
