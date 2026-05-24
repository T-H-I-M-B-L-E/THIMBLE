package handlers

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"

	"chat-app/internal/repositories"
)

// GetEmailPrefs returns the caller's email notification preferences.
func GetEmailPrefs(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	prefs, err := repositories.GetEmailPrefs(c.Context(), userId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "db_failed"})
	}
	var out map[string]bool
	if len(prefs) > 0 {
		_ = json.Unmarshal(prefs, &out)
	}
	if out == nil {
		out = map[string]bool{
			"likes":           true,
			"comments":        true,
			"follows":         true,
			"product_updates": true,
		}
	}
	return c.JSON(out)
}

// UpdateEmailPrefs writes a complete prefs object. Caller sends the full
// map so missing keys are persisted as false — explicit, no merge surprises.
func UpdateEmailPrefs(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	var body map[string]bool
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid prefs"})
	}
	if err := repositories.UpdateEmailPrefs(c.Context(), userId, raw); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "db_failed"})
	}
	return c.JSON(fiber.Map{"success": true})
}
